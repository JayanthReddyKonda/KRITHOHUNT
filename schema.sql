-- ====================================================================
-- College Treasure Hunt Database Schema (QR Code Progression & Real Games)
-- ====================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if they exist (for easy resetting)
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS clues CASCADE;

-- 1. Create clues table
CREATE TABLE clues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color TEXT NOT NULL,
    clue_number INTEGER NOT NULL,
    clue_text TEXT NOT NULL,
    game_type TEXT NOT NULL,
    answer TEXT NOT NULL,
    game_data JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_color_clue UNIQUE (color, clue_number),
    CONSTRAINT valid_clue_number CHECK (clue_number BETWEEN 0 AND 4)
);

-- 2. Create teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clues_solved INTEGER NOT NULL DEFAULT 0,
    penalty_count INTEGER NOT NULL DEFAULT 0,
    finish_time TIMESTAMPTZ,
    waiting_for_qr BOOLEAN NOT NULL DEFAULT TRUE, -- Start in waiting state (must scan QR 1 first)
    CONSTRAINT valid_clues_solved CHECK (clues_solved BETWEEN 0 AND 5)
);

-- ====================================================================
-- Row Level Security (RLS) Configuration
-- ====================================================================

ALTER TABLE clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Note: DO NOT allow public read access to clues table (protects solutions & locations).
-- Instead, participants fetch active clues via the secure get_current_clue RPC.

-- Allow public read access to teams
CREATE POLICY "Allow public read access to teams" 
ON teams FOR SELECT 
USING (true);

-- Allow public insert access to teams (needed for registration)
CREATE POLICY "Allow public insert access to teams" 
ON teams FOR INSERT 
WITH CHECK (true);

-- No direct UPDATE/DELETE is allowed on teams by anonymous clients.
-- All progress updates must go through the secure database functions defined below.

-- ====================================================================
-- Secure Database RPC Functions (Runs as SECURITY DEFINER)
-- ====================================================================

-- A. Fetch the active clue for a team securely (excluding solution)
CREATE OR REPLACE FUNCTION get_current_clue(p_team_id UUID)
RETURNS TABLE(
  id UUID,
  color TEXT,
  clue_number INTEGER,
  clue_text TEXT,
  game_type TEXT,
  game_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_color TEXT;
  v_clues_solved INTEGER;
BEGIN
  -- Get team color and current progress
  SELECT LOWER(teams.color), teams.clues_solved INTO v_color, v_clues_solved
  FROM teams
  WHERE teams.id = p_team_id;

  IF FOUND AND v_clues_solved < 5 THEN
    RETURN QUERY
    SELECT c.id, c.color, c.clue_number, c.clue_text, c.game_type, c.game_data
    FROM clues c
    WHERE LOWER(c.color) = LOWER(v_color) AND c.clue_number = v_clues_solved;
  END IF;
END;
$$;

-- B. Scan location QR code to unlock next game
CREATE OR REPLACE FUNCTION scan_location_qr(
  p_team_id UUID, 
  p_scanned_color TEXT,
  p_scanned_stage INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_color TEXT;
  v_clues_solved INTEGER;
  v_waiting_for_qr BOOLEAN;
  v_finish_time TIMESTAMPTZ;
  v_expected_stage INTEGER;
BEGIN
  -- 1. Fetch team details
  SELECT color, clues_solved, waiting_for_qr, finish_time
  INTO v_team_color, v_clues_solved, v_waiting_for_qr, v_finish_time
  FROM teams
  WHERE id = p_team_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- 2. Check if already finished
  IF v_finish_time IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team has already completed the hunt!');
  END IF;

  -- 3. Check if completed all digital challenges
  IF v_clues_solved >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'All digital challenges are complete. Please visit the Start Desk.');
  END IF;

  -- 4. Calculate expected stage
  v_expected_stage := v_clues_solved + 1;

  -- 5. If they scan another color's QR
  IF LOWER(TRIM(p_scanned_color)) <> LOWER(TRIM(v_team_color)) THEN
    RETURN jsonb_build_object('success', false, 'error', '❌ This QR is not for your path.');
  END IF;

  -- 6. If they scan another stage's QR
  IF p_scanned_stage <> v_expected_stage THEN
    RETURN jsonb_build_object('success', false, 'error', '❌ Wrong location. This is not the correct location for your current clue.');
  END IF;

  -- 7. Correct QR scanned!
  UPDATE teams
  SET waiting_for_qr = false
  WHERE id = p_team_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', '✅ LOCATION VERIFIED! Challenge unlocked.'
  );
END;
$$;

-- C. Submit answer to verify and increment progress
CREATE OR REPLACE FUNCTION submit_team_answer(p_team_id UUID, p_answer TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_color TEXT;
  v_clues_solved INTEGER;
  v_waiting_for_qr BOOLEAN;
  v_correct_answer TEXT;
  v_clue_id UUID;
  v_finish_time TIMESTAMPTZ;
  v_new_clues_solved INTEGER;
  v_new_penalty_count INTEGER;
  v_game_type TEXT;
  v_db_game_data JSONB;
  v_answers_match BOOLEAN := FALSE;
BEGIN
  -- Get team info
  SELECT color, clues_solved, waiting_for_qr, finish_time 
  INTO v_team_color, v_clues_solved, v_waiting_for_qr, v_finish_time
  FROM teams
  WHERE id = p_team_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Check if already finished
  IF v_finish_time IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team has already finished the hunt!');
  END IF;

  -- Check if already solved all digital clues
  IF v_clues_solved >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'All digital games solved. Return to Start Desk.');
  END IF;

  -- Check if waiting for QR scan (cannot solve game before scanning QR)
  IF v_waiting_for_qr THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must physically find the location and scan the correct QR code before starting this challenge.');
  END IF;

  -- Get clue details
  SELECT id, answer, game_type, game_data INTO v_clue_id, v_correct_answer, v_game_type, v_db_game_data
  FROM clues
  WHERE LOWER(color) = LOWER(v_team_color) AND clue_number = v_clues_solved;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Clue data not found for your path & progress step');
  END IF;

  -- Verify logic based on game type
  IF p_answer = 'solve' THEN
    v_answers_match := TRUE;
  ELSIF v_game_type = 'campus_geoguessr' THEN
    -- Geoguessr answer string format is: target_x,target_y,radius
    -- User guess is: x,y
    DECLARE
      v_user_x NUMERIC;
      v_user_y NUMERIC;
      v_target_x NUMERIC;
      v_target_y NUMERIC;
      v_radius NUMERIC;
      v_user_parts TEXT[];
      v_target_parts TEXT[];
    BEGIN
      v_user_parts := string_to_array(p_answer, ',');
      v_target_parts := string_to_array(v_correct_answer, ',');
      
      IF array_length(v_user_parts, 1) = 2 AND array_length(v_target_parts, 1) = 3 THEN
        v_user_x := v_user_parts[1]::numeric;
        v_user_y := v_user_parts[2]::numeric;
        v_target_x := v_target_parts[1]::numeric;
        v_target_y := v_target_parts[2]::numeric;
        v_radius := v_target_parts[3]::numeric;
        
        IF sqrt(power(v_user_x - v_target_x, 2) + power(v_user_y - v_target_y, 2)) <= v_radius THEN
          v_answers_match := TRUE;
        END IF;
      END IF;
    END;
  ELSIF v_game_type = 'connect_dots' THEN
    DECLARE
      v_paths JSONB;
      v_dots JSONB;
      v_path JSONB;
      v_dot JSONB;
      v_p1 JSONB;
      v_p2 JSONB;
      v_cell JSONB;
      v_prev JSONB;
      v_c_id INT;
      v_r INT;
      v_c INT;
      v_pr INT;
      v_pc INT;
      v_len INT;
      v_is_valid BOOLEAN := TRUE;
      v_visited TEXT[] := ARRAY[]::TEXT[];
      v_key TEXT;
      v_rows INT;
      v_cols INT;
    BEGIN
      -- Parse submitted answer
      BEGIN
        v_paths := p_answer::jsonb;
      EXCEPTION WHEN OTHERS THEN
        v_is_valid := FALSE;
      END;

      IF v_is_valid THEN
        -- Fetch game data dots
        v_dots := v_db_game_data->'dots';
        v_rows := COALESCE((v_db_game_data->>'rows')::int, 7);
        v_cols := COALESCE((v_db_game_data->>'cols')::int, 7);
        
        -- Loop through color IDs 1 to 4
        FOR v_c_id IN 1..4 LOOP
          -- Find endpoints for this color
          v_p1 := NULL;
          v_p2 := NULL;
          FOR i IN 0..jsonb_array_length(v_dots)-1 LOOP
            v_dot := v_dots->i;
            IF (v_dot->>2)::int = v_c_id THEN
              IF v_p1 IS NULL THEN
                v_p1 := v_dot;
              ELSE
                v_p2 := v_dot;
              END IF;
            END IF;
          END LOOP;

          -- Get path for this color
          v_path := v_paths->(v_c_id::text);
          IF v_path IS NULL OR jsonb_array_length(v_path) < 2 THEN
            v_is_valid := FALSE;
            EXIT;
          END IF;

          v_len := jsonb_array_length(v_path);
          
          -- Check start and end endpoints match (p1 and p2 can be start/end or vice-versa)
          DECLARE
            v_start_cell JSONB := v_path->0;
            v_end_cell JSONB := v_path->(v_len - 1);
            v_s_r INT := (v_start_cell->>0)::int;
            v_s_c INT := (v_start_cell->>1)::int;
            v_e_r INT := (v_end_cell->>0)::int;
            v_e_c INT := (v_end_cell->>1)::int;
            v_p1_r INT := (v_p1->>0)::int;
            v_p1_c INT := (v_p1->>1)::int;
            v_p2_r INT := (v_p2->>0)::int;
            v_p2_c INT := (v_p2->>1)::int;
          BEGIN
            IF NOT (
              ((v_s_r = v_p1_r AND v_s_c = v_p1_c) AND (v_e_r = v_p2_r AND v_e_c = v_p2_c)) OR
              ((v_s_r = v_p2_r AND v_s_c = v_p2_c) AND (v_e_r = v_p1_r AND v_e_c = v_p1_c))
            ) THEN
              v_is_valid := FALSE;
            END IF;
          END;

          IF NOT v_is_valid THEN
            EXIT;
          END IF;

          -- Check path steps
          FOR j IN 0..v_len-1 LOOP
            v_cell := v_path->j;
            v_r := (v_cell->>0)::int;
            v_c := (v_cell->>1)::int;

            -- Check bounds
            IF v_r < 0 OR v_r >= v_rows OR v_c < 0 OR v_c >= v_cols THEN
              v_is_valid := FALSE;
              EXIT;
            END IF;

            -- Check unique cells (no overlaps or crossings)
            v_key := v_r::text || ',' || v_c::text;
            IF v_key = ANY(v_visited) THEN
              v_is_valid := FALSE;
              EXIT;
            END IF;
            v_visited := array_append(v_visited, v_key);

            -- Check another color's endpoint
            FOR k IN 0..jsonb_array_length(v_dots)-1 LOOP
              v_dot := v_dots->k;
              IF (v_dot->>2)::int <> v_c_id AND (v_dot->>0)::int = v_r AND (v_dot->>1)::int = v_c THEN
                v_is_valid := FALSE;
                EXIT;
              END IF;
            END LOOP;
            
            IF NOT v_is_valid THEN
              EXIT;
            END IF;

            -- Check orthogonal move
            IF j > 0 THEN
              v_prev := v_path->(j-1);
              v_pr := (v_prev->>0)::int;
              v_pc := (v_prev->>1)::int;
              IF abs(v_r - v_pr) + abs(v_c - v_pc) <> 1 THEN
                v_is_valid := FALSE;
                EXIT;
              END IF;
            END IF;
          END LOOP;

          IF NOT v_is_valid THEN
            EXIT;
          END IF;
        END LOOP;
      ELSE
        v_is_valid := FALSE;
      END IF;

      IF v_is_valid THEN
        v_answers_match := TRUE;
      END IF;
    END;
  ELSE
    -- Standard comparison for other games (Sudoku grid, Dots grid, Hanoi, Safe combination)
    IF REPLACE(LOWER(TRIM(p_answer)), ' ', '') = REPLACE(LOWER(TRIM(v_correct_answer)), ' ', '') THEN
      v_answers_match := TRUE;
    END IF;
  END IF;

  -- Act on verification result
  IF v_answers_match THEN
    -- Correct!
    UPDATE teams
    SET clues_solved = clues_solved + 1,
        waiting_for_qr = CASE WHEN (clues_solved + 1) < 5 THEN TRUE ELSE FALSE END
    WHERE id = p_team_id
    RETURNING clues_solved INTO v_new_clues_solved;

    RETURN jsonb_build_object(
      'success', true,
      'clues_solved', v_new_clues_solved,
      'message', 'Correct answer! Next clue unlocked.'
    );
  ELSE
    -- Incorrect!
    UPDATE teams
    SET penalty_count = penalty_count + 1
    WHERE id = p_team_id
    RETURNING penalty_count INTO v_new_penalty_count;

    RETURN jsonb_build_object(
      'success', false,
      'penalty_count', v_new_penalty_count,
      'error', 'Incorrect answer. Try again!'
    );
  END IF;
END;
$$;

-- D. Organizer marks team as finished after physical jigsaw
CREATE OR REPLACE FUNCTION mark_team_finished(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clues_solved INTEGER;
  v_finish_time TIMESTAMPTZ;
BEGIN
  -- Get team info
  SELECT clues_solved, finish_time INTO v_clues_solved, v_finish_time
  FROM teams
  WHERE id = p_team_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  IF v_finish_time IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team already marked finished');
  END IF;

  IF v_clues_solved < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team has not completed all 5 digital games');
  END IF;

  -- Update finish time
  UPDATE teams
  SET finish_time = NOW()
  WHERE id = p_team_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Team successfully completed the hunt!'
  );
END;
$$;

-- D. Submit connect the dots answer securely
CREATE OR REPLACE FUNCTION submit_connect_dots(p_team_id UUID, p_paths JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_color TEXT;
  v_clues_solved INTEGER;
  v_waiting_for_qr BOOLEAN;
  v_finish_time TIMESTAMPTZ;
  v_clue_id UUID;
  v_game_type TEXT;
  v_db_game_data JSONB;
  
  v_dots JSONB;
  v_rows INT;
  v_cols INT;
  v_c_id INT;
  v_dot1 JSONB;
  v_dot2 JSONB;
  v_path JSONB;
  v_len INT;
  v_cell JSONB;
  v_r INT;
  v_c INT;
  v_prev JSONB;
  v_pr INT;
  v_pc INT;
  v_key TEXT;
  v_visited TEXT[] := ARRAY[]::TEXT[];
  v_is_valid BOOLEAN := TRUE;
  v_reason TEXT := NULL;
  
  v_new_clues_solved INT;
  v_new_penalty_count INT;
BEGIN
  -- Fetch team details with row lock to prevent double-submission / race conditions
  SELECT color, clues_solved, waiting_for_qr, finish_time
  INTO v_team_color, v_clues_solved, v_waiting_for_qr, v_finish_time
  FROM teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Check if already finished
  IF v_finish_time IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team has already completed the hunt!');
  END IF;

  -- Get current clue details
  SELECT id, game_type, game_data INTO v_clue_id, v_game_type, v_db_game_data
  FROM clues
  WHERE LOWER(color) = LOWER(v_team_color) AND clue_number = v_clues_solved;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Clue data not found for your path & progress step');
  END IF;

  -- Verify stage is Connect Dots
  IF v_game_type <> 'connect_dots' THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not currently on the Connect Dots stage (perhaps already solved).');
  END IF;

  -- Verify game is unlocked
  IF v_waiting_for_qr THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must physically find the location and scan the correct QR code before starting this challenge.');
  END IF;

  -- Perform rule-based path validation
  v_dots := v_db_game_data->'dots';
  v_rows := COALESCE((v_db_game_data->>'rows')::int, 7);
  v_cols := COALESCE((v_db_game_data->>'cols')::int, 7);

  FOR v_c_id IN 1..4 LOOP
    -- Find endpoints for this color ID
    v_dot1 := NULL;
    v_dot2 := NULL;
    FOR i IN 0..jsonb_array_length(v_dots)-1 LOOP
      IF (v_dots->i->>2)::int = v_c_id THEN
        IF v_dot1 IS NULL THEN
          v_dot1 := v_dots->i;
        ELSE
          v_dot2 := v_dots->i;
        END IF;
      END IF;
    END LOOP;

    IF v_dot1 IS NULL OR v_dot2 IS NULL THEN
      v_is_valid := FALSE;
      v_reason := 'Invalid puzzle config: endpoints missing';
      EXIT;
    END IF;

    -- Get path
    v_path := p_paths->(v_c_id::text);
    IF v_path IS NULL OR jsonb_array_length(v_path) < 2 THEN
      v_is_valid := FALSE;
      v_reason := CASE v_c_id 
        WHEN 1 THEN 'Red pair is not connected'
        WHEN 2 THEN 'Blue pair is not connected'
        WHEN 3 THEN 'Green pair is not connected'
        WHEN 4 THEN 'Yellow pair is not connected'
        ELSE 'A pair is not connected'
      END;
      EXIT;
    END IF;

    v_len := jsonb_array_length(v_path);
    
    -- Check endpoints match (p1 and p2 can be start/end or vice-versa)
    DECLARE
      v_s_r INT := (v_path->0->>0)::int;
      v_s_c INT := (v_path->0->>1)::int;
      v_e_r INT := (v_path->(v_len-1)->>0)::int;
      v_e_c INT := (v_path->(v_len-1)->>1)::int;
      v_p1_r INT := (v_dot1->>0)::int;
      v_p1_c INT := (v_dot1->>1)::int;
      v_p2_r INT := (v_dot2->>0)::int;
      v_p2_c INT := (v_dot2->>1)::int;
    BEGIN
      IF NOT (
        ((v_s_r = v_p1_r AND v_s_c = v_p1_c) AND (v_e_r = v_p2_r AND v_e_c = v_p2_c)) OR
        ((v_s_r = v_p2_r AND v_s_c = v_p2_c) AND (v_e_r = v_p1_r AND v_e_c = v_p1_c))
      ) THEN
        v_is_valid := FALSE;
        v_reason := CASE v_c_id 
          WHEN 1 THEN 'Red path does not connect matching endpoints'
          WHEN 2 THEN 'Blue path does not connect matching endpoints'
          WHEN 3 THEN 'Green path does not connect matching endpoints'
          WHEN 4 THEN 'Yellow path does not connect matching endpoints'
          ELSE 'Path does not connect matching endpoints'
        END;
      END IF;
    END;

    IF NOT v_is_valid THEN
      EXIT;
    END IF;

    -- Check path steps
    FOR j IN 0..v_len-1 LOOP
      v_cell := v_path->j;
      v_r := (v_cell->>0)::int;
      v_c := (v_cell->>1)::int;

      -- Check grid boundaries
      IF v_r < 0 OR v_r >= v_rows OR v_c < 0 OR v_c >= v_cols THEN
        v_is_valid := FALSE;
        v_reason := CASE v_c_id 
          WHEN 1 THEN 'Red path leaves the grid'
          WHEN 2 THEN 'Blue path leaves the grid'
          WHEN 3 THEN 'Green path leaves the grid'
          WHEN 4 THEN 'Yellow path leaves the grid'
          ELSE 'Path leaves the grid'
        END;
        EXIT;
      END IF;

      -- Check orthogonal move (adjacent cells only)
      IF j > 0 THEN
        v_prev := v_path->(j-1);
        v_pr := (v_prev->>0)::int;
        v_pc := (v_prev->>1)::int;
        IF abs(v_r - v_pr) + abs(v_c - v_pc) <> 1 THEN
          v_is_valid := FALSE;
          v_reason := CASE v_c_id 
            WHEN 1 THEN 'Red path has non-adjacent moves'
            WHEN 2 THEN 'Blue path has non-adjacent moves'
            WHEN 3 THEN 'Green path has non-adjacent moves'
            WHEN 4 THEN 'Yellow path has non-adjacent moves'
            ELSE 'Path has non-adjacent moves'
          END;
          EXIT;
        END IF;
      END IF;

      -- Check another color's endpoint
      FOR k IN 0..jsonb_array_length(v_dots)-1 LOOP
        IF (v_dots->k->>2)::int <> v_c_id AND (v_dots->k->>0)::int = v_r AND (v_dots->k->>1)::int = v_c THEN
          v_is_valid := FALSE;
          v_reason := CASE v_c_id 
            WHEN 1 THEN 'Red path passes through another endpoint'
            WHEN 2 THEN 'Blue path passes through another endpoint'
            WHEN 3 THEN 'Green path passes through another endpoint'
            WHEN 4 THEN 'Yellow path passes through another endpoint'
            ELSE 'Path passes through another endpoint'
          END;
          EXIT;
        END IF;
      END LOOP;

      IF NOT v_is_valid THEN
        EXIT;
      END IF;

      -- Check collisions/overlaps between paths
      v_key := v_r::text || ',' || v_c::text;
      IF v_key = ANY(v_visited) THEN
        v_is_valid := FALSE;
        v_reason := 'Paths overlap or collide';
        EXIT;
      END IF;
      v_visited := array_append(v_visited, v_key);
    END LOOP;

    IF NOT v_is_valid THEN
      EXIT;
    END IF;
  END LOOP;

  -- Act on validation result
  IF v_is_valid THEN
    -- Correct! Advance progress
    UPDATE teams
    SET clues_solved = clues_solved + 1,
        waiting_for_qr = CASE WHEN (clues_solved + 1) < 5 THEN TRUE ELSE FALSE END
    WHERE id = p_team_id
    RETURNING clues_solved INTO v_new_clues_solved;

    RETURN jsonb_build_object(
      'success', true,
      'clues_solved', v_new_clues_solved,
      'message', 'Correct answer! Next clue unlocked.'
    );
  ELSE
    -- Incorrect! Increment penalty count
    UPDATE teams
    SET penalty_count = penalty_count + 1
    WHERE id = p_team_id
    RETURNING penalty_count INTO v_new_penalty_count;

    RETURN jsonb_build_object(
      'success', false,
      'error', v_reason,
      'penalty_count', v_new_penalty_count
    );
  END IF;
END;
$$;

-- ====================================================================
-- Seeding Real Game Data
-- ====================================================================

INSERT INTO clues (color, clue_number, clue_text, game_type, answer, game_data) VALUES
-- RED PATH
('red', 0, 'Head to the Central Library Entrance and scan the location QR code to unlock Game 1.', 'sudoku', '[[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]]', '{"puzzle": [[1,0,3,0],[0,4,0,2],[2,0,4,0],[0,3,0,1]]}'),
('red', 1, 'Proceed to the Fountain Courtyard. Locate the QR code on the brass plaque bench.', 'connect_dots', '7x7_custom_validated', '{"rows": 7, "cols": 7, "dots": [[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('red', 2, 'Go to the Science Block, Room 204. Locate the location QR code on the notice board.', 'campus_geoguessr', '200,100,30', '{"instructions": "The photo shows the reflection of the clock tower in the water pool. Point out where this is on the campus map.", "label": "Reflecting Pool"}'),
('red', 3, 'Walk to the Student Center Cafe and find the location QR code posted near the menu board.', 'tower_hanoi', 'hanoi_solved', '{}'),
('red', 4, 'Search the Auditorium main lobby doors for the location QR code.', 'safe_cracker', '4826', '{"instructions": "Riddle: Combine the numbers: Second digit of fountain bench year, number of pillars at central library, first digit of post office box, and number of library doors."}'),

-- BLUE PATH
('blue', 0, 'Go to the Gym registration desk and scan the location QR code to unlock Game 1.', 'sudoku', '[[2,3,4,1],[4,1,2,3],[3,2,1,4],[1,4,3,2]]', '{"puzzle": [[2,0,4,0],[0,1,0,3],[3,0,1,0],[0,4,0,2]]}'),
('blue', 1, 'Proceed to the Dean office reception area. Scan the location QR code on the brochures stand.', 'connect_dots', '7x7_custom_validated', '{"rows": 7, "cols": 7, "dots": [[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('blue', 2, 'Go to the IT Lab, Block A. Scan the location QR code posted on the server room window.', 'campus_geoguessr', '330,100,25', '{"instructions": "The photo shows a wall of basketball trophies. Pinpoint the correct block on the campus map.", "label": "Trophy Room"}'),
('blue', 3, 'Walk to the Football Field grandstand. Locate the QR code near Row C.', 'tower_hanoi', 'hanoi_solved', '{}'),
('blue', 4, 'Find the location QR code posted near the Art Gallery side entrance.', 'safe_cracker', '1973', '{"instructions": "Riddle: Code is: First year the college was opened. Year starts with 197_."}'),

-- GREEN PATH
('green', 0, 'Go to the Botanical Garden entrance. Scan the location QR code on the welcome sign.', 'sudoku', '[[3,4,1,2],[1,2,3,4],[4,3,2,1],[2,1,4,3]]', '{"puzzle": [[0,4,0,2],[1,0,3,0],[0,3,0,1],[2,0,4,0]]}'),
('green', 1, 'Walk to the Chemistry Lab lobby. Scan the QR code posted on the safety cabinet door.', 'connect_dots', '7x7_custom_validated', '{"rows": 7, "cols": 7, "dots": [[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('green', 2, 'Proceed to the parking lot near Block B. Locate the QR code on the blue dumpster.', 'campus_geoguessr', '200,200,30', '{"instructions": "The photo shows a rare hybrid orchid blossom. Locate this zone on the campus map.", "label": "Orchid Dome"}'),
('green', 3, 'Go to the Open Air Theater (OAT) center stage. Scan the QR code on the speaker cover.', 'tower_hanoi', 'hanoi_solved', '{}'),
('green', 4, 'Find the location QR code at the base of the clock tower.', 'safe_cracker', '3628', '{"instructions": "Riddle: Safe code digits match: Total workshop bays, chemistry labs, seminar rooms, and main gates."}'),

-- YELLOW PATH
('yellow', 0, 'Go to the Admin Block lobby. Scan the location QR code behind the central pillar.', 'sudoku', '[[4,1,2,3],[2,3,4,1],[1,2,3,4],[3,4,1,2]]', '{"puzzle": [[0,1,0,3],[2,0,4,0],[0,2,0,4],[3,0,1,0]]}'),
('yellow', 1, 'Proceed to the Seminar Hall entrance. Scan the QR code posted on the frame.', 'connect_dots', '7x7_custom_validated', '{"rows": 7, "cols": 7, "dots": [[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('yellow', 2, 'Go to the Tennis Court referee stand. Scan the QR code on the clipboard hook.', 'campus_geoguessr', '70,150,25', '{"instructions": "The photo shows a flag hoisted high over columns. Pinpoint this administrative location on the campus map.", "label": "Flagpole Plaza"}'),
('yellow', 3, 'Proceed to the Hostel Block mess hall entrance. Scan the QR code on the menu stand.', 'tower_hanoi', 'hanoi_solved', '{}'),
('yellow', 4, 'Go to the campus Post Office drop box. Scan the QR code on the side.', 'safe_cracker', '7159', '{"instructions": "Riddle: Safe code is: The digits of the campus zip code reversed."}'),

-- PURPLE PATH
('purple', 0, 'Go to the Mechanical Workshop main bay. Scan the QR code on the toolbox rack.', 'sudoku', '[[1,3,2,4],[2,4,1,3],[4,2,3,1],[3,1,4,2]]', '{"puzzle": [[1,0,2,0],[0,4,0,3],[4,0,3,0],[0,1,0,2]]}'),
('purple', 1, 'Proceed to the Physics Lab research wing. Scan the QR code on the emergency pull.', 'connect_dots', '7x7_custom_validated', '{"rows": 7, "cols": 7, "dots": [[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('purple', 2, 'Walk to the Cafeteria rooftop. Scan the location QR code under the parasol base.', 'campus_geoguessr', '70,250,25', '{"instructions": "The photo shows a Tesla coil glowing in the dark. Mark this science lab room on the campus map.", "label": "High Voltage Lab"}'),
('purple', 3, 'Proceed to the campus Bank ATM booth. Scan the QR code near the receipts bin.', 'tower_hanoi', 'hanoi_solved', '{}'),
('purple', 4, 'Find the location QR code near the counter of the Stationary Shop.', 'safe_cracker', '8492', '{"instructions": "Riddle: Enter the numbers that correspond to letters H, D, I, B in standard alphabet index."}'),

-- ORANGE PATH
('orange', 0, 'Go to the Main Parking Area entrance gate. Scan the QR code on the ticket box.', 'sudoku', '[[4,2,3,1],[3,1,4,2],[2,4,1,3],[1,3,2,4]]', '{"puzzle": [[0,2,0,1],[3,0,4,0],[0,4,0,3],[1,0,2,0]]}'),
('orange', 1, 'Proceed to the Music Room lobby. Scan the QR code on top of the upright piano.', 'connect_dots', '7x7_custom_validated', '{"rows": 7, "cols": 7, "dots": [[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('orange', 2, 'Go to the Computer Lab block lobby. Scan the QR code beneath the stairs.', 'campus_geoguessr', '330,280,25', '{"instructions": "The photo shows a steam espresso dial ticking. Choose this catering spot on the campus map.", "label": "Espresso Bar"}'),
('orange', 3, 'Go to the Conference Center reception desk. Scan the QR code under the mat.', 'tower_hanoi', 'hanoi_solved', '{}'),
('orange', 4, 'Find the location QR code posted on the Student Council office mail slot.', 'safe_cracker', '6205', '{"instructions": "Riddle: Code is: Reverse of the first digits of the five campus blocks."}')
ON CONFLICT (color, clue_number) 
DO UPDATE SET 
    clue_text = EXCLUDED.clue_text,
    game_type = EXCLUDED.game_type,
    answer = EXCLUDED.answer,
    game_data = EXCLUDED.game_data;


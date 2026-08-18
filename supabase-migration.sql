-- ====================================================================
-- KRITHOHUNT - Supabase Migration (Clean Version)
-- Run this in Supabase Dashboard → SQL Editor
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- TABLES
-- ====================================================================

-- clues table
CREATE TABLE IF NOT EXISTS clues (
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

-- teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clues_solved INTEGER NOT NULL DEFAULT 0,
    penalty_count INTEGER NOT NULL DEFAULT 0,
    finish_time TIMESTAMPTZ,
    waiting_for_qr BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT valid_clues_solved CHECK (clues_solved BETWEEN 0 AND 5)
);

-- ====================================================================
-- ROW LEVEL SECURITY
-- ====================================================================

ALTER TABLE clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- clues: no public read (protects solutions)
-- teams: public read + insert allowed; updates/deletes via RPC only
DROP POLICY IF EXISTS teams_select ON teams;
DROP POLICY IF EXISTS teams_insert ON teams;
CREATE POLICY teams_select ON teams FOR SELECT USING (true);
CREATE POLICY teams_insert ON teams FOR INSERT WITH CHECK (true);

GRANT SELECT ON TABLE public.teams TO anon, authenticated;
GRANT INSERT ON TABLE public.teams TO anon, authenticated;

-- No direct UPDATE/DELETE on teams - must use RPC functions

-- ====================================================================
-- RPC FUNCTIONS (SECURITY DEFINER - bypasses RLS)
-- ====================================================================

-- Get current clue for team
CREATE OR REPLACE FUNCTION get_current_clue(p_team_id UUID)
RETURNS TABLE(
  id UUID, color TEXT, clue_number INTEGER,
  clue_text TEXT, game_type TEXT, game_data JSONB
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_color TEXT; v_clues_solved INTEGER;
BEGIN
  SELECT LOWER(color), clues_solved INTO v_color, v_clues_solved
  FROM teams WHERE id = p_team_id;
  IF FOUND AND v_clues_solved < 5 THEN
    RETURN QUERY SELECT c.id, c.color, c.clue_number, c.clue_text, c.game_type, c.game_data
    FROM public.clues AS c WHERE LOWER(c.color) = v_color AND c.clue_number = v_clues_solved;
  END IF;
END;
$$;

-- Scan location QR
CREATE OR REPLACE FUNCTION scan_location_qr(
  p_team_id UUID, p_scanned_color TEXT, p_scanned_stage INTEGER
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_team_color TEXT; v_clues_solved INT; v_waiting_for_qr BOOL;
  v_finish_time TIMESTAMPTZ; v_expected_stage INT;
BEGIN
  SELECT color, clues_solved, waiting_for_qr, finish_time
  INTO v_team_color, v_clues_solved, v_waiting_for_qr, v_finish_time
  FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Team not found'); END IF;
  IF v_finish_time IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Team already finished'); END IF;
  IF v_clues_solved >= 5 THEN RETURN jsonb_build_object('success', false, 'error', 'All challenges complete'); END IF;
  v_expected_stage := v_clues_solved + 1;
  IF LOWER(TRIM(p_scanned_color)) <> LOWER(TRIM(v_team_color)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wrong path color');
  END IF;
  IF p_scanned_stage <> v_expected_stage THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wrong stage');
  END IF;
  UPDATE teams SET waiting_for_qr = false WHERE id = p_team_id;
  RETURN jsonb_build_object('success', true, 'message', 'Location verified');
END;
$$;

-- Submit team answer
CREATE OR REPLACE FUNCTION validate_connect_dots(p_paths JSONB, p_game_data JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_color INT;
  v_path JSONB;
  v_cell JSONB;
  v_previous JSONB;
  v_first JSONB;
  v_last JSONB;
  v_endpoint_one JSONB;
  v_endpoint_two JSONB;
  v_length INT;
  v_row INT;
  v_col INT;
  v_previous_row INT;
  v_previous_col INT;
  v_index INT;
  v_rows INT := COALESCE((p_game_data->>'rows')::INT, 7);
  v_cols INT := COALESCE((p_game_data->>'cols')::INT, 7);
  v_visited TEXT[] := ARRAY[]::TEXT[];
  v_key TEXT;
BEGIN
  IF jsonb_typeof(p_paths) <> 'object' OR jsonb_typeof(p_game_data->'dots') <> 'array' THEN
    RETURN FALSE;
  END IF;

  FOR v_color IN 1..4 LOOP
    SELECT value INTO v_endpoint_one
    FROM jsonb_array_elements(p_game_data->'dots')
    WHERE (value->>2)::INT = v_color
    OFFSET 0 LIMIT 1;
    SELECT value INTO v_endpoint_two
    FROM jsonb_array_elements(p_game_data->'dots')
    WHERE (value->>2)::INT = v_color
    OFFSET 1 LIMIT 1;

    v_path := p_paths -> v_color::TEXT;
    IF v_endpoint_one IS NULL OR v_endpoint_two IS NULL
       OR jsonb_typeof(v_path) <> 'array'
       OR jsonb_array_length(v_path) < 2 THEN
      RETURN FALSE;
    END IF;

    v_length := jsonb_array_length(v_path);
    v_first := v_path -> 0;
    v_last := v_path -> (v_length - 1);
    IF NOT (
      ((v_first->>0)::INT = (v_endpoint_one->>0)::INT AND (v_first->>1)::INT = (v_endpoint_one->>1)::INT
       AND (v_last->>0)::INT = (v_endpoint_two->>0)::INT AND (v_last->>1)::INT = (v_endpoint_two->>1)::INT)
      OR
      ((v_first->>0)::INT = (v_endpoint_two->>0)::INT AND (v_first->>1)::INT = (v_endpoint_two->>1)::INT
       AND (v_last->>0)::INT = (v_endpoint_one->>0)::INT AND (v_last->>1)::INT = (v_endpoint_one->>1)::INT)
    ) THEN
      RETURN FALSE;
    END IF;

    FOR v_index IN 0..(v_length - 1) LOOP
      v_cell := v_path -> v_index;
      v_row := (v_cell->>0)::INT;
      v_col := (v_cell->>1)::INT;
      IF v_row < 0 OR v_row >= v_rows OR v_col < 0 OR v_col >= v_cols THEN
        RETURN FALSE;
      END IF;
      v_key := v_row::TEXT || ',' || v_col::TEXT;
      IF v_key = ANY(v_visited) THEN
        RETURN FALSE;
      END IF;
      v_visited := array_append(v_visited, v_key);
      IF v_index > 0 THEN
        v_previous := v_path -> (v_index - 1);
        v_previous_row := (v_previous->>0)::INT;
        v_previous_col := (v_previous->>1)::INT;
        IF abs(v_row - v_previous_row) + abs(v_col - v_previous_col) <> 1 THEN
          RETURN FALSE;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION submit_team_answer(p_team_id UUID, p_answer TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_team_color TEXT; v_clues_solved INT; v_waiting_for_qr BOOL;
  v_finish_time TIMESTAMPTZ; v_correct_answer TEXT; v_game_type TEXT;
  v_game_data JSONB; v_match BOOL := FALSE; v_new_clues INT; v_new_penalties INT;
  v_user_x NUMERIC; v_user_y NUMERIC; v_round_num INT; v_target_x NUMERIC;
  v_target_y NUMERIC; v_radius NUMERIC; v_distance NUMERIC; v_parts TEXT[];
BEGIN
  SELECT color, clues_solved, waiting_for_qr, finish_time
  INTO v_team_color, v_clues_solved, v_waiting_for_qr, v_finish_time
  FROM teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Team not found'); END IF;
  IF v_finish_time IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Already finished'); END IF;
  IF v_clues_solved >= 5 THEN RETURN jsonb_build_object('success', false, 'error', 'All challenges done'); END IF;
  IF v_waiting_for_qr THEN RETURN jsonb_build_object('success', false, 'error', 'Scan QR first'); END IF;
  SELECT answer, game_type, game_data INTO v_correct_answer, v_game_type, v_game_data
  FROM clues WHERE LOWER(color) = LOWER(v_team_color) AND clue_number = v_clues_solved;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Clue not found'); END IF;

  -- Verify answer based on game type
  IF v_game_type = 'campus_geoguessr' THEN
    BEGIN
      v_parts := string_to_array(p_answer, ',');
      v_user_x := v_parts[1]::numeric;
      v_user_y := v_parts[2]::numeric;
      v_round_num := COALESCE(v_parts[3]::int, 1);
      IF v_user_x < 0 OR v_user_x > 1 OR v_user_y < 0 OR v_user_y > 1 THEN
        v_match := FALSE;
      ELSE
        v_target_x := COALESCE(
          (v_game_data->'rounds'->(v_round_num - 1)->'target'->>'x')::numeric,
          CASE v_round_num WHEN 1 THEN 0.31 WHEN 2 THEN 0.31 WHEN 3 THEN 0.315 WHEN 4 THEN 0.6495 WHEN 5 THEN 0.4008 END
        );
        v_target_y := COALESCE(
          (v_game_data->'rounds'->(v_round_num - 1)->'target'->>'y')::numeric,
          CASE v_round_num WHEN 1 THEN 0.30 WHEN 2 THEN 0.16 WHEN 3 THEN 0.25 WHEN 4 THEN 0.77 WHEN 5 THEN 0.17 END
        );
        v_radius := COALESCE((v_game_data->'rounds'->(v_round_num - 1)->>'radius')::numeric, 0.10);
        v_distance := sqrt(power(v_user_x - v_target_x, 2) + power(v_user_y - v_target_y, 2));
        v_match := v_distance <= v_radius;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_match := FALSE;
    END;
  ELSIF v_game_type = 'connect_dots' THEN
    v_match := public.validate_connect_dots(p_answer::jsonb, v_game_data);
  ELSE
    v_match := REPLACE(LOWER(TRIM(p_answer)), ' ', '') = REPLACE(LOWER(TRIM(v_correct_answer)), ' ', '');
  END IF;

  IF v_match THEN
    UPDATE teams SET clues_solved = clues_solved + 1,
      waiting_for_qr = CASE WHEN clues_solved + 1 < 5 THEN TRUE ELSE FALSE END
    WHERE id = p_team_id RETURNING clues_solved INTO v_new_clues;
    RETURN jsonb_build_object('success', true, 'clues_solved', v_new_clues, 'message', 'Correct!');
  ELSE
    UPDATE teams SET penalty_count = penalty_count + 1 WHERE id = p_team_id
    RETURNING penalty_count INTO v_new_penalties;
    RETURN jsonb_build_object('success', false, 'penalty_count', v_new_penalties, 'error', 'Incorrect');
  END IF;
END;
$$;

-- Mark team finished
CREATE OR REPLACE FUNCTION mark_team_finished(p_team_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_clues INT; v_finish TIMESTAMPTZ;
BEGIN
  SELECT clues_solved, finish_time INTO v_clues, v_finish FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Team not found'); END IF;
  IF v_finish IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Already finished'); END IF;
  IF v_clues < 5 THEN RETURN jsonb_build_object('success', false, 'error', 'Not all challenges done'); END IF;
  UPDATE teams SET finish_time = NOW() WHERE id = p_team_id;
  RETURN jsonb_build_object('success', true, 'message', 'Team finished');
END;
$$;

-- Admin delete team
CREATE OR REPLACE FUNCTION admin_delete_team(p_team_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_name TEXT;
BEGIN
  SELECT name INTO v_name FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Team not found'); END IF;
  DELETE FROM teams WHERE id = p_team_id;
  RETURN jsonb_build_object('success', true, 'message', v_name || ' deleted');
END;
$$;

CREATE OR REPLACE FUNCTION submit_connect_dots(p_team_id UUID, p_paths JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.submit_team_answer(p_team_id, p_paths::TEXT);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_clue(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_location_qr(UUID, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_team_answer(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_connect_dots(UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_team_finished(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_team(UUID) TO anon, authenticated;

-- ====================================================================
-- SEED DATA (6 paths × 5 clues = 30 clues)
-- ====================================================================

INSERT INTO clues (color, clue_number, clue_text, game_type, answer, game_data) VALUES
-- RED PATH (rose)
('red', 0, 'Head to Central Library Entrance. Scan QR to unlock Game 1.', 'sudoku',
 '[[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]]',
 '{"puzzle":[[1,0,3,0],[0,4,0,2],[2,0,4,0],[0,3,0,1]]}'),
('red', 1, 'Proceed to Fountain Courtyard. Scan QR on brass plaque.', 'connect_dots',
 '7x7_valid', '{"rows":7,"cols":7,"dots":[[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('red', 2, 'Go to Science Block Room 204. Scan QR on notice board.', 'campus_geoguessr',
 'geo_5', '{"map_image":"/geo/campus-satellite.png"}'),
('red', 3, 'Walk to Student Center Cafe. Scan QR near menu.', 'tower_hanoi', 'hanoi_solved', '{}'),
('red', 4, 'Search Auditorium lobby doors for QR.', 'safe_cracker', '4826', '{"instructions":"Combine: fountain year 2nd digit, library pillars, PO box 1st digit, library doors"}'),

-- BLUE PATH (cyan)
('blue', 0, 'Go to Gym registration. Scan QR for Game 1.', 'sudoku',
 '[[2,3,4,1],[4,1,2,3],[3,2,1,4],[1,4,3,2]]', '{"puzzle":[[2,0,4,0],[0,1,0,3],[3,0,1,0],[0,4,0,2]]}'),
('blue', 1, 'Proceed to Dean office reception. Scan QR on brochures.', 'connect_dots',
 '7x7_valid', '{"rows":7,"cols":7,"dots":[[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('blue', 2, 'Go to IT Lab Block A. Scan QR on server room window.', 'campus_geoguessr', 'geo_5', '{"map_image":"/geo/campus-satellite.png"}'),
('blue', 3, 'Walk to Football Field grandstand. Scan QR near Row C.', 'tower_hanoi', 'hanoi_solved', '{}'),
('blue', 4, 'Find QR near Art Gallery side entrance.', 'safe_cracker', '1973', '{"instructions":"College opening year: 197_"}'),

-- GREEN PATH (emerald)
('green', 0, 'Botanical Garden entrance. Scan QR on welcome sign.', 'sudoku',
 '[[3,4,1,2],[1,2,3,4],[4,3,2,1],[2,1,4,3]]', '{"puzzle":[[0,4,0,2],[1,0,3,0],[0,3,0,1],[2,0,4,0]]}'),
('green', 1, 'Chemistry Lab lobby. Scan QR on safety cabinet.', 'connect_dots', '7x7_valid',
 '{"rows":7,"cols":7,"dots":[[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('green', 2, 'Parking lot near Block B. QR on blue dumpster.', 'campus_geoguessr', 'geo_5', '{"map_image":"/geo/campus-satellite.png"}'),
('green', 3, 'Open Air Theater center stage. QR on speaker.', 'tower_hanoi', 'hanoi_solved', '{}'),
('green', 4, 'Base of clock tower. Find QR.', 'safe_cracker', '3628', '{"instructions":"Workshop bays, chem labs, seminar rooms, main gates"}'),

-- YELLOW PATH (amber)
('yellow', 0, 'Admin Block lobby. QR behind central pillar.', 'sudoku',
 '[[4,1,2,3],[2,3,4,1],[1,2,3,4],[3,4,1,2]]', '{"puzzle":[[0,1,0,3],[2,0,4,0],[0,2,0,4],[3,0,1,0]]}'),
('yellow', 1, 'Seminar Hall entrance. QR on frame.', 'connect_dots', '7x7_valid',
 '{"rows":7,"cols":7,"dots":[[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('yellow', 2, 'Tennis Court referee stand. QR on clipboard.', 'campus_geoguessr', 'geo_5', '{"map_image":"/geo/campus-satellite.png"}'),
('yellow', 3, 'Hostel Block mess hall. QR on menu stand.', 'tower_hanoi', 'hanoi_solved', '{}'),
('yellow', 4, 'Campus Post Office drop box. QR on side.', 'safe_cracker', '7159', '{"instructions":"Campus zip code reversed"}'),

-- PURPLE PATH (violet)
('purple', 0, 'Mechanical Workshop bay. QR on toolbox.', 'sudoku',
 '[[1,3,2,4],[2,4,1,3],[4,2,3,1],[3,1,4,2]]', '{"puzzle":[[1,0,2,0],[0,4,0,3],[4,0,3,0],[0,1,0,2]]}'),
('purple', 1, 'Physics Lab wing. QR on emergency pull.', 'connect_dots', '7x7_valid',
 '{"rows":7,"cols":7,"dots":[[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('purple', 2, 'Cafeteria rooftop. QR under parasol.', 'campus_geoguessr', 'geo_5', '{"map_image":"/geo/campus-satellite.png"}'),
('purple', 3, 'Campus Bank ATM. QR near receipts.', 'tower_hanoi', 'hanoi_solved', '{}'),
('purple', 4, 'Stationary Shop counter. Find QR.', 'safe_cracker', '8492', '{"instructions":"Letters H,D,I,B alphabet index"}'),

-- ORANGE PATH (orange)
('orange', 0, 'Main Parking entrance. QR on ticket box.', 'sudoku',
 '[[4,2,3,1],[3,1,4,2],[2,4,1,3],[1,3,2,4]]', '{"puzzle":[[0,2,0,1],[3,0,4,0],[0,4,0,3],[1,0,2,0]]}'),
('orange', 1, 'Music Room lobby. QR on upright piano.', 'connect_dots', '7x7_valid',
 '{"rows":7,"cols":7,"dots":[[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'),
('orange', 2, 'Computer Lab lobby. QR beneath stairs.', 'campus_geoguessr', 'geo_5', '{"map_image":"/geo/campus-satellite.png"}'),
('orange', 3, 'Conference Center reception. QR under mat.', 'tower_hanoi', 'hanoi_solved', '{}'),
('orange', 4, 'Student Council office mail slot. QR posted.', 'safe_cracker', '6205', '{"instructions":"Reverse of first digits of five campus blocks"}')
ON CONFLICT (color, clue_number) DO UPDATE SET
  clue_text = EXCLUDED.clue_text, game_type = EXCLUDED.game_type,
  answer = EXCLUDED.answer, game_data = EXCLUDED.game_data;
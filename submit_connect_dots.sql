-- SQL migration to add submit_connect_dots RPC and update puzzle layout

-- 1. Create the secure submit_connect_dots RPC
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

-- 2. Update the seed data to use the new 7x7 puzzle layout for all team colors
UPDATE clues
SET game_data = '{"rows": 7, "cols": 7, "dots": [[0,1,1],[4,5,1],[1,5,2],[5,1,2],[2,0,3],[4,2,3],[3,5,4],[6,2,4]]}'
WHERE game_type = 'connect_dots';

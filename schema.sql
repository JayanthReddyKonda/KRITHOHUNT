-- ====================================================================
-- College Treasure Hunt Database Schema
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
    CONSTRAINT valid_clues_solved CHECK (clues_solved BETWEEN 0 AND 5)
);

-- ====================================================================
-- Row Level Security (RLS) Configuration
-- ====================================================================

ALTER TABLE clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Note: DO NOT allow public read access to clues table (protects solutions).
-- Instead, participants fetch clues via the secure get_current_clue RPC.

-- Allow public read access to teams
CREATE POLICY "Allow public read access to teams" 
ON teams FOR SELECT 
USING (true);

-- Allow public insert access to teams (needed for registration)
CREATE POLICY "Allow public insert access to teams" 
ON teams FOR INSERT 
WITH CHECK (true);

-- No direct UPDATE is allowed on teams by anonymous client.
-- All progress updates (clues_solved, penalty_count, finish_time) 
-- must go through the secure database functions defined below.

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

-- B. Submit answer to verify and increment progress
CREATE OR REPLACE FUNCTION submit_team_answer(p_team_id UUID, p_answer TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_color TEXT;
  v_clues_solved INTEGER;
  v_correct_answer TEXT;
  v_clue_id UUID;
  v_finish_time TIMESTAMPTZ;
  v_new_clues_solved INTEGER;
  v_new_penalty_count INTEGER;
BEGIN
  -- Get team info
  SELECT color, clues_solved, finish_time INTO v_team_color, v_clues_solved, v_finish_time
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

  -- Get clue answers
  SELECT id, answer INTO v_clue_id, v_correct_answer
  FROM clues
  WHERE LOWER(color) = LOWER(v_team_color) AND clue_number = v_clues_solved;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Clue data not found for your path & progress step');
  END IF;

  -- Compare answer (whitespace and case insensitive)
  IF REPLACE(LOWER(TRIM(p_answer)), ' ', '') = REPLACE(LOWER(TRIM(v_correct_answer)), ' ', '') THEN
    -- Correct!
    UPDATE teams
    SET clues_solved = clues_solved + 1
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

-- C. Organizer marks team as finished after physical jigsaw
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

-- ====================================================================
-- Sample Seed Data
-- ====================================================================

-- Insert 5 games for each of the 6 paths (red, blue, green, yellow, purple, orange)
-- Game 1 (clue_number = 0) is a real 4x4 Sudoku game.
-- Games 2-5 use placeholders where the correct answer is 'solve'.
INSERT INTO clues (color, clue_number, clue_text, game_type, answer, game_data) VALUES
-- RED PATH
('red', 0, 'Go to the Central Library Entrance. Look under the directory sign for a clue sticker.', 'sudoku', '[[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]]', '{"label": "Red Game 1: Sudoku", "puzzle": [[1,0,3,0],[0,4,0,2],[2,0,4,0],[0,3,0,1]]}'),
('red', 1, 'Walk over to the Fountain Courtyard. Locate the bench with the brass plaque.', 'connect_dots', 'solve', '{"label": "Red Game 2: Connect the Dots"}'),
('red', 2, 'Head to the Science Block, Room 204. Find the poster on the notice board.', 'campus_geoguessr', 'solve', '{"label": "Red Game 3: Campus GeoGuessr"}'),
('red', 3, 'Make your way to the Student Center Cafe. Ask the barista for the "Special Scroll".', 'safe_cracker', 'solve', '{"label": "Red Game 4: Safe Cracker"}'),
('red', 4, 'Go to the Auditorium main doors. Search behind the display case.', 'pipe_puzzle', 'solve', '{"label": "Red Game 5: Pipe Puzzle"}'),

-- BLUE PATH
('blue', 0, 'Go to the Gym registration desk. Check the bulletin board.', 'sudoku', '[[2,3,4,1],[4,1,2,3],[3,2,1,4],[1,4,3,2]]', '{"label": "Blue Game 1: Sudoku", "puzzle": [[2,0,4,0],[0,1,0,3],[3,0,1,0],[0,4,0,2]]}'),
('blue', 1, 'Walk to the Dean office reception area. Check the brochure holder.', 'connect_dots', 'solve', '{"label": "Blue Game 2: Connect the Dots"}'),
('blue', 2, 'Head to the IT Lab, Block A. Look near the server room window.', 'campus_geoguessr', 'solve', '{"label": "Blue Game 3: Campus GeoGuessr"}'),
('blue', 3, 'Proceed to the Football Field grandstand. Look under seat 42 in Row C.', 'safe_cracker', 'solve', '{"label": "Blue Game 4: Safe Cracker"}'),
('blue', 4, 'Go to the Art Gallery side entrance. Search near the bronze sculpture.', 'pipe_puzzle', 'solve', '{"label": "Blue Game 5: Pipe Puzzle"}'),

-- GREEN PATH
('green', 0, 'Go to the Botanical Garden entrance. Look at the welcome sign.', 'sudoku', '[[3,4,1,2],[1,2,3,4],[4,3,2,1],[2,1,4,3]]', '{"label": "Green Game 1: Sudoku", "puzzle": [[0,4,0,2],[1,0,3,0],[0,3,0,1],[2,0,4,0]]}'),
('green', 1, 'Walk to the chemistry lab lobby. Check the cabinet glass.', 'connect_dots', 'solve', '{"label": "Green Game 2: Connect the Dots"}'),
('green', 2, 'Head to the parking lot near Block B. Locate the blue dumpster.', 'campus_geoguessr', 'solve', '{"label": "Green Game 3: Campus GeoGuessr"}'),
('green', 3, 'Walk to the Open Air Theater (OAT) center stage. Search under the speaker cover.', 'safe_cracker', 'solve', '{"label": "Green Game 4: Safe Cracker"}'),
('green', 4, 'Go to the main clock tower base. Look around the iron fence.', 'pipe_puzzle', 'solve', '{"label": "Green Game 5: Pipe Puzzle"}'),

-- YELLOW PATH
('yellow', 0, 'Head to the admin block lobby. Check behind the pillar.', 'sudoku', '[[4,1,2,3],[2,3,4,1],[1,2,3,4],[3,4,1,2]]', '{"label": "Yellow Game 1: Sudoku", "puzzle": [[0,1,0,3],[2,0,4,0],[0,2,0,4],[3,0,1,0]]}'),
('yellow', 1, 'Go to the seminar hall entryway. Look on the door frame.', 'connect_dots', 'solve', '{"label": "Yellow Game 2: Connect the Dots"}'),
('yellow', 2, 'Walk to the tennis court referee stand. Check the clipboard hook.', 'campus_geoguessr', 'solve', '{"label": "Yellow Game 3: Campus GeoGuessr"}'),
('yellow', 3, 'Head to the hostel block mess hall entrance. Check the menu display.', 'safe_cracker', 'solve', '{"label": "Yellow Game 4: Safe Cracker"}'),
('yellow', 4, 'Proceed to the campus post office drop box. Look on the side.', 'pipe_puzzle', 'solve', '{"label": "Yellow Game 5: Pipe Puzzle"}'),

-- PURPLE PATH
('purple', 0, 'Go to the mechanical workshop main bay. Check the toolbox rack.', 'sudoku', '[[1,3,2,4],[2,4,1,3],[4,2,3,1],[3,1,4,2]]', '{"label": "Purple Game 1: Sudoku", "puzzle": [[1,0,2,0],[0,4,0,3],[4,0,3,0],[0,1,0,2]]}'),
('purple', 1, 'Head to the physics lab research wing. Check the emergency shower pull.', 'connect_dots', 'solve', '{"label": "Purple Game 2: Connect the Dots"}'),
('purple', 2, 'Walk to the cafeteria rooftop seating area. Search under the parasol base.', 'campus_geoguessr', 'solve', '{"label": "Purple Game 3: Campus GeoGuessr"}'),
('purple', 3, 'Go to the campus bank ATM booth. Look near the receipts bin.', 'safe_cracker', 'solve', '{"label": "Purple Game 4: Safe Cracker"}'),
('purple', 4, 'Proceed to the stationary shop counter. Check the pencil display.', 'pipe_puzzle', 'solve', '{"label": "Purple Game 5: Pipe Puzzle"}'),

-- ORANGE PATH
('orange', 0, 'Go to the main parking area entrance gate. Look at the ticket dispenser.', 'sudoku', '[[4,2,3,1],[3,1,4,2],[2,4,1,3],[1,3,2,4]]', '{"label": "Orange Game 1: Sudoku", "puzzle": [[0,2,0,1],[3,0,4,0],[0,4,0,3],[1,0,2,0]]}'),
('orange', 1, 'Walk to the music room lobby. Look on top of the upright piano.', 'connect_dots', 'solve', '{"label": "Orange Game 2: Connect the Dots"}'),
('orange', 2, 'Head to the computer lab block lobby staircase. Check beneath the stairs.', 'campus_geoguessr', 'solve', '{"label": "Orange Game 3: Campus GeoGuessr"}'),
('orange', 3, 'Go to the conference center reception desk. Search under the keyboard mat.', 'safe_cracker', 'solve', '{"label": "Orange Game 4: Safe Cracker"}'),
('orange', 4, 'Walk to the student council office door. Check the mail slot.', 'pipe_puzzle', 'solve', '{"label": "Orange Game 5: Pipe Puzzle"}')
ON CONFLICT (color, clue_number) 
DO UPDATE SET 
    clue_text = EXCLUDED.clue_text,
    game_type = EXCLUDED.game_type,
    answer = EXCLUDED.answer,
    game_data = EXCLUDED.game_data;

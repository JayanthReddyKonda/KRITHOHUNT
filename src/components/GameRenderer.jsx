import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import SudokuGame from './SudokuGame';
import { HelpCircle, CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';

const GAME_TITLES = {
  sudoku: 'Game 1: Mini Sudoku',
  connect_dots: 'Game 2: Connect the Dots by Color Pair',
  campus_geoguessr: 'Game 3: Campus GeoGuessr',
  safe_cracker: 'Game 4: Safe Cracker / Combo Lock',
  pipe_puzzle: 'Game 5: Pipe / Circuit Puzzle'
};

const GAME_DESCRIPTIONS = {
  sudoku: 'Arrange numbers 1-4 in the grid.',
  connect_dots: 'Link matching color nodes without crossing paths.',
  campus_geoguessr: 'Identify the campus landmark based on the cropped photo.',
  safe_cracker: 'Determine the 4-digit code using the hot/cold indicators.',
  pipe_puzzle: 'Rotate the grid joints to connect the flow from input to output.'
};

export default function GameRenderer({ teamId, colorTheme, gameType, gameData, onSolved, onIncorrect }) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { success: boolean, message: string }

  // If the game type is sudoku, dispatch to the custom Sudoku component
  if (gameType === 'sudoku') {
    return (
      <SudokuGame
        teamId={teamId}
        colorTheme={colorTheme}
        gameData={gameData}
        onSolved={onSolved}
        onIncorrect={onIncorrect}
      />
    );
  }

  // Fallback simulator for other placeholder games (connect_dots, campus_geoguessr, etc.)
  const handleAction = async (answer) => {
    setLoading(true);
    setFeedback(null);

    try {
      const { data, error } = await supabase.rpc('submit_team_answer', {
        p_team_id: teamId,
        p_answer: answer
      });

      if (error) throw error;

      if (data.success) {
        setFeedback({
          success: true,
          message: data.message || '🎉 PUZZLE SOLVED! Next clue unlocked.'
        });
      } else {
        setFeedback({
          success: false,
          message: data.error || 'Incorrect answer. Penalty count increased (+1)!'
        });
        onIncorrect();
      }
    } catch (err) {
      console.error(err);
      setFeedback({
        success: false,
        message: err.message || 'Error submitting answer. Please check connection.'
      });
    } finally {
      setLoading(false);
    }
  };

  const title = GAME_TITLES[gameType] || 'Digital Game Challenge';
  const desc = GAME_DESCRIPTIONS[gameType] || 'Complete this challenge to unlock the next location clue.';

  if (feedback && feedback.success) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <h3 className="text-xl font-extrabold text-emerald-400 mb-2">
          PUZZLE SOLVED!
        </h3>
        <p className="text-slate-300 text-sm max-w-xs mb-6">
          Amazing work. You solved the {title.split(': ')[1] || 'challenge'}!
        </p>
        <button
          onClick={() => {
            setFeedback(null);
            onSolved();
          }}
          className={`w-full py-4 px-6 rounded-xl text-slate-950 font-bold text-sm tracking-widest uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${colorTheme.bg} ${colorTheme.hover}`}
        >
          <span>Continue</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Game info header */}
      <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex gap-3 items-start">
        <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-slate-100">{title}</h4>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
        </div>
      </div>

      {/* Simulator Interface */}
      <div className="p-6 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-center">
        <div className="inline-block px-3 py-1 bg-slate-900 border border-slate-800 rounded-md text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-4">
          Placeholder Simulator
        </div>
        
        <p className="text-xs text-slate-400 max-w-xs mx-auto mb-6">
          This digital puzzle will be implemented later. Use the testing buttons below to simulate completion.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleAction('solve')}
            disabled={loading}
            className={`w-full py-3.5 px-4 rounded-xl text-slate-950 font-bold text-xs tracking-wider uppercase shadow-md flex items-center justify-center gap-2 transition-all ${colorTheme.bg} ${colorTheme.hover} disabled:opacity-50`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>Solve Test Puzzle</span>
            )}
          </button>

          <button
            onClick={() => handleAction('wrong')}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-semibold text-xs tracking-wider uppercase transition-all disabled:opacity-50"
          >
            <span>Test Wrong Answer</span>
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {feedback && !feedback.success && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2.5 items-start">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Try again: </span>
            <span>{feedback.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

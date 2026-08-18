import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { HelpCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import ConnectDotsGame from './ConnectDotsGame';
import SudokuGame from './SudokuGame';
import TowerOfHanoiGame from './games/TowerOfHanoiGame';
import SafeCrackerGame from './games/SafeCrackerGame';
import CampusGeoguessrGame from './CampusGeoguessrGame';

export default function GameRenderer({ teamId, colorTheme, gameType, gameData, onSolved, onIncorrect }) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { success: boolean, message: string }

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
        setFeedback({ success: true, message: 'Correct answer!' });
        setTimeout(() => {
          onSolved();
        }, 1000);
      } else {
        setFeedback({ success: false, message: data.error || 'Incorrect answer!' });
        onIncorrect();
      }
    } catch (err) {
      console.error(err);
      setFeedback({ success: false, message: err.message || 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

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

  if (gameType === 'connect_dots') {
    return (
      <ConnectDotsGame
        teamId={teamId}
        colorTheme={colorTheme}
        gameData={gameData}
        onSolved={onSolved}
        onIncorrect={onIncorrect}
      />
    );
  }

  if (gameType === 'campus_geoguessr' || gameType === 'geo_guess') {
    return (
      <CampusGeoguessrGame
        teamId={teamId}
        colorTheme={colorTheme}
        gameData={gameData}
        onSolved={onSolved}
        onIncorrect={onIncorrect}
      />
    );
  }

  if (gameType === 'tower_hanoi' || gameType === 'tower_of_hanoi') {
    return (
      <TowerOfHanoiGame
        teamId={teamId}
        colorTheme={colorTheme}
        onSolved={onSolved}
        onIncorrect={onIncorrect}
      />
    );
  }

  if (gameType === 'safe_cracker') {
    return (
      <SafeCrackerGame
        teamId={teamId}
        colorTheme={colorTheme}
        gameData={gameData}
        onSolved={onSolved}
        onIncorrect={onIncorrect}
      />
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="p-5 bg-slate-900 border border-slate-850 rounded-2xl text-center space-y-4">
        <div className="inline-flex p-3 rounded-full bg-slate-950 border border-slate-850">
          <HelpCircle className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
            Game Simulator: {gameType.replace('_', ' ')}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
            Testing Progression Flow
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {feedback && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              feedback.success 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400 animate-shake'
            }`}>
              {feedback.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <button
            onClick={() => handleAction('solve')}
            disabled={loading}
            className="w-full py-3 bg-emerald-650 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Solve Test Puzzle</span>}
          </button>

          <button
            onClick={() => handleAction('wrong')}
            disabled={loading}
            className="w-full py-3 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 text-red-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Test Wrong Answer</span>
          </button>
        </div>
      </div>
    </div>
  );
}

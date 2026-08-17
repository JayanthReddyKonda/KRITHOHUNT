import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import GameRenderer from './GameRenderer';
import { Compass, Trophy, Clock, Skull, RefreshCw, LogOut, Loader2, MapPin, CheckCircle } from 'lucide-react';

const PATH_THEMES = {
  red: { name: 'Red', bg: 'bg-red-500', hover: 'hover:bg-red-650', text: 'text-red-400', border: 'border-red-500/30', rgb: '239, 68, 68', gradient: 'from-red-600/10' },
  blue: { name: 'Blue', bg: 'bg-blue-500', hover: 'hover:bg-blue-650', text: 'text-blue-400', border: 'border-blue-500/30', rgb: '59, 130, 246', gradient: 'from-blue-600/10' },
  green: { name: 'Green', bg: 'bg-emerald-500', hover: 'hover:bg-emerald-650', text: 'text-emerald-400', border: 'border-emerald-500/30', rgb: '16, 185, 129', gradient: 'from-emerald-600/10' },
  yellow: { name: 'Yellow', bg: 'bg-amber-500', hover: 'hover:bg-amber-650', text: 'text-amber-400', border: 'border-amber-500/30', rgb: '245, 158, 11', gradient: 'from-amber-600/10' },
  purple: { name: 'Purple', bg: 'bg-violet-500', hover: 'hover:bg-violet-650', text: 'text-violet-400', border: 'border-violet-500/30', rgb: '139, 92, 246', gradient: 'from-violet-600/10' },
  orange: { name: 'Orange', bg: 'bg-orange-500', hover: 'hover:bg-orange-650', text: 'text-orange-400', border: 'border-orange-500/30', rgb: '249, 115, 22', gradient: 'from-orange-600/10' }
};

export default function PlayScreen({ teamId, onReset }) {
  const [team, setTeam] = useState(null);
  const [clue, setClue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchGameState = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      setError('');
      // 1. Fetch team details
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle();

      if (teamError) throw teamError;

      if (!teamData) {
        // Session not in DB anymore
        localStorage.removeItem('treasure_hunt_team_id');
        onReset();
        return;
      }

      setTeam(teamData);

      // 2. Fetch current clue if not finished with digital games securely (excluding solution)
      if (teamData.clues_solved < 5) {
        const { data: clueData, error: clueError } = await supabase
          .rpc('get_current_clue', { p_team_id: teamId });

        if (clueError) throw clueError;
        setClue(clueData && clueData.length > 0 ? clueData[0] : null);
      } else {
        setClue(null);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch game state. Please check your network connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId, onReset]);

  useEffect(() => {
    fetchGameState();

    // Auto refresh every 10 seconds if team is waiting for the organizer finish
    let intervalId;
    if (team && team.clues_solved === 5 && !team.finish_time) {
      intervalId = setInterval(() => {
        fetchGameState(false);
      }, 10000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [team?.clues_solved, team?.finish_time, fetchGameState]);

  const handleLogout = () => {
    if (confirm('Are you sure you want to reset this session? Your progress in the database will NOT be deleted, but you will need to enter your team name again to resume.')) {
      localStorage.removeItem('treasure_hunt_team_id');
      onReset();
    }
  };

  const getDurationText = (start, finish) => {
    if (!start || !finish) return '';
    const diff = new Date(finish) - new Date(start);
    const totalSecs = Math.floor(diff / 1000);
    const minutes = Math.floor(totalSecs / 60);
    const seconds = totalSecs % 60;
    return `${minutes}m ${seconds}s`;
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[80vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs text-slate-400">Loading game progress...</span>
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm">
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchGameState()}
            className="px-4 py-2 bg-slate-850 border border-slate-700 hover:bg-slate-800 rounded-xl text-xs text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const theme = PATH_THEMES[team.color.toLowerCase()] || PATH_THEMES.red;

  // SCREEN A: Treasure Hunt Complete (Finished State)
  if (team.finish_time) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-20 bg-emerald-500" />

        <div className="w-full max-w-sm text-center">
          <div className="inline-flex p-4 rounded-full bg-emerald-500/10 border border-emerald-500/25 mb-4 shadow-lg animate-bounce">
            <Trophy className="w-12 h-12 text-emerald-400" />
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1">
            CONGRATULATIONS!
          </h1>
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-6">
            Treasure Hunt Complete
          </p>

          <div className="bg-slate-900/60 border border-emerald-500/20 rounded-3xl p-6 shadow-2xl backdrop-blur-lg space-y-6 text-left relative overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <span className="text-sm font-semibold text-slate-400">Team Name</span>
              <span className="text-sm font-bold text-white uppercase">{team.name}</span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <span className="text-sm font-semibold text-slate-400">Path Color</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${theme.bg} text-slate-950`}>
                {theme.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-2xl flex flex-col items-center justify-center">
                <Clock className="w-5 h-5 text-indigo-400 mb-1" />
                <span className="text-[10px] uppercase font-semibold text-slate-500">Time Taken</span>
                <span className="text-base font-extrabold text-white mt-0.5">
                  {getDurationText(team.start_time, team.finish_time)}
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-2xl flex flex-col items-center justify-center">
                <Skull className="w-5 h-5 text-amber-500 mb-1" />
                <span className="text-[10px] uppercase font-semibold text-slate-500">Penalties</span>
                <span className="text-base font-extrabold text-white mt-0.5">{team.penalty_count}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem('treasure_hunt_team_id');
              onReset();
            }}
            className="mt-8 text-xs text-slate-500 hover:text-slate-400 font-semibold underline underline-offset-4"
          >
            Start New Game / Scan New Path
          </button>
        </div>
      </div>
    );
  }

  // SCREEN B: Waiting for Organizer to Mark Finished (Clues solved = 5)
  if (team.clues_solved === 5) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-20 bg-indigo-500" />

        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-full bg-slate-900 border border-slate-800 mb-3 shadow-inner">
              <CheckCircle className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-black text-white">ALL DIGITAL CHALLENGES COMPLETE!</h1>
          </div>

          <div className="bg-slate-900/65 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-lg text-center space-y-6">
            <p className="text-sm text-slate-300 leading-relaxed">
              Your final challenge is physical and awaits you at the <strong className="text-white">START DESK</strong>.
            </p>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-850 text-left">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Your Instruction:</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Organizers will hand you a <strong className="text-indigo-400">9-piece club logo jigsaw puzzle</strong>. Assemble it correctly, and the organizer will verify your finish to record your final score.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-850 flex flex-col gap-3">
              <button
                onClick={() => fetchGameState(true)}
                disabled={refreshing}
                className="w-full py-3.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>Check If Organizer Marked Finished</span>
              </button>
              <p className="text-[10px] text-slate-500">Screen auto-refreshes every 10 seconds</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SCREEN C: Active Gameplay Clue Screen (clues_solved < 5)
  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8 relative">
      {/* Background glow matching color theme */}
      <div 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-15 transition-all duration-500"
        style={{ backgroundColor: `rgb(${theme.rgb})` }}
      />

      <div className="w-full max-w-sm">
        {/* Header toolbar */}
        <div className="flex justify-between items-center mb-5 px-1">
          <div className="flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Team: {team.name}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-400 uppercase tracking-wider transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Clue Panel Container */}
        <div 
          className="bg-slate-900/65 border rounded-3xl p-6 shadow-2xl backdrop-blur-lg glow-active relative overflow-hidden transition-all duration-300"
          style={{ 
            borderColor: `rgba(${theme.rgb}, 0.25)`,
            '--theme-color-rgb': theme.rgb
          }}
        >
          {/* Card Header progress tracker */}
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-800">
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Active Location</span>
              <span className={`text-base font-extrabold uppercase tracking-tight ${theme.text}`}>
                {theme.name} Path
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Progress</span>
              <span className="text-sm font-black text-slate-300">
                Clue {team.clues_solved + 1} / 5
              </span>
            </div>
          </div>

          {/* Current Clue Description */}
          <div className="space-y-4 mb-6">
            <div className="flex gap-2.5 items-start">
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-850 shrink-0 mt-0.5">
                <MapPin className="w-4.5 h-4.5 text-slate-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Location Instruction</h4>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {clue ? clue.clue_text : 'Find the QR code at your next destination.'}
                </p>
              </div>
            </div>
          </div>

          {/* The game component */}
          {clue && (
            <GameRenderer 
              teamId={team.id}
              colorTheme={theme}
              gameType={clue.game_type}
              gameData={clue.game_data}
              onSolved={() => fetchGameState(false)}
              onIncorrect={() => fetchGameState(false)}
            />
          )}

          {/* Stats Bar */}
          <div className="mt-6 pt-4 border-t border-slate-850 flex justify-between text-slate-500 text-[10px] font-semibold uppercase">
            <span className="flex items-center gap-1">
              <Skull className="w-3.5 h-3.5 text-amber-500" />
              <span>Penalties: {team.penalty_count}</span>
            </span>
            <button 
              onClick={() => fetchGameState(true)}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-400"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

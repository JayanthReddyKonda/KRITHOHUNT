import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

export default function CampusGeoguessrGame({ teamId, colorTheme, gameData, onSolved, onIncorrect }) {
  const instructions = gameData?.instructions || 'Identify this campus landmark based on the clue and tap its location on the map.';
  const label = gameData?.label || 'Target Location';

  // Coordinate states (0 to 100 percentages)
  const [pin, setPin] = useState(null); // { x, y }
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setPin({ x, y });
    setErrorMsg('');
  };

  const checkPuzzleSolved = async () => {
    if (!pin) {
      setErrorMsg('Please tap on the map to place your guess pin first.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Format as "x,y" string
      const coordinateGuess = `${pin.x},${pin.y}`;

      // Call database RPC
      const { data, error } = await supabase.rpc('submit_team_answer', {
        p_team_id: teamId,
        p_answer: coordinateGuess
      });

      if (error) throw error;

      if (data.success) {
        setSuccessMsg(`🎉 Correct! You identified the ${label}!`);
        setTimeout(() => {
          onSolved();
        }, 1500);
      } else {
        setErrorMsg(data.error || 'Incorrect location. That is not the spot! Penalty count increased (+1).');
        onIncorrect();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to render the stylized SVG visual clue based on target label
  const renderVisualClue = () => {
    switch (label) {
      case 'Reflecting Pool':
        return (
          <svg viewBox="0 0 100 100" className="w-16 h-16 mx-auto stroke-indigo-400 fill-none stroke-[2]">
            <ellipse cx="50" cy="50" rx="35" ry="20" className="stroke-indigo-500/40" />
            <path d="M 25 50 Q 50 65 75 50" />
            <path d="M 30 55 Q 50 70 70 55" className="opacity-60" />
            <path d="M 40 40 L 40 25 M 60 40 L 60 25 M 50 35 L 50 15" strokeWidth="3" className="stroke-slate-500" />
          </svg>
        );
      case 'Trophy Room':
        return (
          <svg viewBox="0 0 100 100" className="w-16 h-16 mx-auto stroke-indigo-400 fill-none stroke-[2]">
            <path d="M 30 30 L 70 30 L 65 60 Q 65 75 50 75 Q 35 75 35 60 Z" fill="rgba(99,102,241,0.05)" />
            <path d="M 50 75 L 50 85 M 35 85 L 65 85" strokeWidth="3" />
            <path d="M 30 40 Q 20 40 25 50 Q 30 60 35 55" />
            <path d="M 70 40 Q 80 40 75 50 Q 70 60 65 55" />
          </svg>
        );
      case 'Orchid Dome':
        return (
          <svg viewBox="0 0 100 100" className="w-16 h-16 mx-auto stroke-indigo-400 fill-none stroke-[2]">
            <path d="M 15 80 A 35 35 0 0 1 85 80 Z" fill="rgba(99,102,241,0.05)" />
            <line x1="50" y1="10" x2="50" y2="80" strokeDasharray="3 3" />
            <line x1="15" y1="80" x2="85" y2="80" strokeWidth="3" />
            <circle cx="50" cy="50" r="15" className="stroke-indigo-500/30" />
            <path d="M 35 65 Q 50 50 65 65" />
          </svg>
        );
      case 'Flagpole Plaza':
        return (
          <svg viewBox="0 0 100 100" className="w-16 h-16 mx-auto stroke-indigo-400 fill-none stroke-[2]">
            <line x1="40" y1="90" x2="40" y2="15" strokeWidth="3" />
            <path d="M 40 20 L 75 30 L 40 40 Z" fill="rgba(99,102,241,0.1)" className="fill-indigo-500/20" />
            <circle cx="40" cy="15" r="3" fill="#818cf8" />
            <rect x="25" y="85" width="30" height="8" rx="2" fill="#1e293b" />
          </svg>
        );
      case 'High Voltage Lab':
        return (
          <svg viewBox="0 0 100 100" className="w-16 h-16 mx-auto stroke-indigo-400 fill-none stroke-[2]">
            <path d="M 50 15 L 35 50 L 55 50 L 40 85 L 70 45 L 48 45 Z" fill="rgba(245,158,11,0.1)" className="stroke-amber-400 fill-amber-500/20" />
            <circle cx="50" cy="50" r="30" strokeDasharray="4 4" className="stroke-indigo-500/30" />
          </svg>
        );
      case 'Espresso Bar':
        return (
          <svg viewBox="0 0 100 100" className="w-16 h-16 mx-auto stroke-indigo-400 fill-none stroke-[2]">
            <path d="M 30 40 L 70 40 L 65 75 A 15 15 0 0 1 35 75 Z" fill="rgba(99,102,241,0.05)" />
            <path d="M 70 45 Q 80 45 80 52 Q 80 60 70 60" />
            <path d="M 25 80 L 75 80" strokeWidth="3" />
            <path d="M 40 15 Q 43 25 40 30 M 50 12 Q 53 22 50 28 M 60 15 Q 63 25 60 30" strokeDasharray="2 2" />
          </svg>
        );
      default:
        return <Sparkles className="w-10 h-10 text-indigo-400 mx-auto" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions header */}
      <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 text-left flex gap-3 items-start">
        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/25 shrink-0 mt-0.5">
          {renderVisualClue()}
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Game 3: Campus GeoGuessr
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {instructions}
          </p>
        </div>
      </div>

      {/* Campus Map SVG Canvas */}
      <div className="flex flex-col items-center">
        <div className="relative w-full max-w-[320px] select-none rounded-2xl overflow-hidden border border-slate-850 bg-slate-950 shadow-inner">
          
          <svg 
            viewBox="0 0 400 400" 
            onClick={handleMapClick}
            className="w-full h-auto cursor-crosshair bg-slate-950"
          >
            {/* Grid blueprint lines */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(51, 65, 85, 0.2)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Campus buildings rendering */}
            <g opacity="0.85">
              {/* Library (0,0) - (120,100) */}
              <rect x="15" y="15" width="100" height="90" rx="8" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <text x="65" y="65" fill="#475569" fontSize="10" fontWeight="bold" textAnchor="middle">Library</text>

              {/* Science Block (0,200) - (120,300) */}
              <rect x="15" y="215" width="100" height="90" rx="8" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <text x="65" y="265" fill="#475569" fontSize="10" fontWeight="bold" textAnchor="middle">Science</text>

              {/* Fountain (200,100) */}
              <circle cx="200" cy="100" r="30" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <text x="200" y="104" fill="#475569" fontSize="9" fontWeight="bold" textAnchor="middle">Fountain</text>

              {/* Botanical Garden (200,200) */}
              <circle cx="200" cy="200" r="30" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <text x="200" y="204" fill="#475569" fontSize="9" fontWeight="bold" textAnchor="middle">Garden</text>

              {/* Auditorium (200,320) */}
              <rect x="140" y="295" width="120" height="85" rx="8" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <text x="200" y="340" fill="#475569" fontSize="10" fontWeight="bold" textAnchor="middle">Auditorium</text>

              {/* Gym (330,100) */}
              <rect x="295" y="55" width="90" height="90" rx="8" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <text x="340" y="105" fill="#475569" fontSize="10" fontWeight="bold" textAnchor="middle">Gym</text>

              {/* Open Air Theater / OAT (330,200) */}
              <circle cx="330" cy="200" r="28" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <text x="330" y="203" fill="#475569" fontSize="9" fontWeight="bold" textAnchor="middle">OAT</text>

              {/* Student Cafe (330,280) */}
              <rect x="295" y="245" width="90" height="90" rx="8" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <text x="340" y="295" fill="#475569" fontSize="10" fontWeight="bold" textAnchor="middle">Cafeteria</text>

              {/* Admin Block (70, 150) */}
              <rect x="15" y="125" width="100" height="70" rx="8" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
              <text x="65" y="165" fill="#475569" fontSize="10" fontWeight="bold" textAnchor="middle">Admin</text>
            </g>

            {/* Tap Marker Pin */}
            {pin && (
              <g transform={`translate(${(pin.x / 100) * 400}, ${(pin.y / 100) * 400})`}>
                <circle cx="0" cy="0" r="14" className="fill-indigo-500/10 stroke-indigo-500 animate-ping" strokeWidth="1" />
                <circle cx="0" cy="0" r="5" fill="#6366f1" />
                {/* Pointer marker icon */}
                <path d="M 0 -2 L -5 -15 A 5 5 0 0 1 5 -15 Z" fill="#6366f1" />
                <circle cx="0" cy="-15" r="2" fill="white" />
              </g>
            )}
          </svg>

          {/* Floating Coordinate HUD */}
          <div className="absolute bottom-2.5 right-2.5 px-2 py-1 bg-slate-950/80 border border-slate-800 rounded-md text-[9px] font-mono text-slate-500 select-none pointer-events-none">
            {pin ? `Target: X ${pin.x}% | Y ${pin.y}%` : 'Tap to place pin'}
          </div>
        </div>
      </div>

      {/* Submit Action & Alerts */}
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2.5 items-start animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Incorrect Spot: </span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2.5 items-start">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Success: </span>
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        <button
          onClick={checkPuzzleSolved}
          disabled={loading || !pin || !!successMsg}
          style={pin && !successMsg ? { backgroundColor: `rgba(${colorTheme.rgb}, 0.9)` } : {}}
          className={`
            w-full py-4 rounded-2xl text-slate-950 font-bold text-xs tracking-wider uppercase shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50
            ${successMsg ? 'bg-emerald-500 text-slate-950' : 'hover:brightness-110'}
          `}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span>Submit Guess</span>
          )}
        </button>
      </div>
    </div>
  );
}

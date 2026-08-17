import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Compass, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';

const PATH_THEMES = {
  red: { name: 'Red', bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30', ring: 'focus:ring-red-500', hover: 'hover:bg-red-600', rgb: '239, 68, 68' },
  blue: { name: 'Blue', bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30', ring: 'focus:ring-blue-500', hover: 'hover:bg-blue-600', rgb: '59, 130, 246' },
  green: { name: 'Green', bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', ring: 'focus:ring-emerald-500', hover: 'hover:bg-emerald-600', rgb: '16, 185, 129' },
  yellow: { name: 'Yellow', bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30', ring: 'focus:ring-amber-500', hover: 'hover:bg-amber-600', rgb: '245, 158, 11' },
  purple: { name: 'Purple', bg: 'bg-violet-500', text: 'text-violet-400', border: 'border-violet-500/30', ring: 'focus:ring-violet-500', hover: 'hover:bg-violet-600', rgb: '139, 92, 246' },
  orange: { name: 'Orange', bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30', ring: 'focus:ring-orange-500', hover: 'hover:bg-orange-600', rgb: '249, 115, 22' }
};

export default function StartScreen({ onRegistered }) {
  const [color, setColor] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlColor = (params.get('color') || '').toLowerCase();
    
    if (urlColor && PATH_THEMES[urlColor]) {
      setColor(urlColor);
    } else {
      setError('Invalid or missing path color! Please scan the correct QR code provided by the organizer.');
    }
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setError('Please enter a team name.');
      return;
    }
    if (!color) {
      setError('No valid color path detected.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const trimmedName = teamName.trim();
      
      // 1. Check if team name already exists
      const { data: existingTeam, error: fetchError } = await supabase
        .from('teams')
        .select('*')
        .eq('name', trimmedName)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingTeam) {
        // Resume session if colors match
        if (existingTeam.color.toLowerCase() === color) {
          localStorage.setItem('treasure_hunt_team_id', existingTeam.id);
          onRegistered(existingTeam.id);
          return;
        } else {
          setError(`"${trimmedName}" is already registered on the ${existingTeam.color.toUpperCase()} path.`);
          setLoading(false);
          return;
        }
      }

      // 2. Create new team
      const { data: newTeam, error: insertError } = await supabase
        .from('teams')
        .insert([{ name: trimmedName, color: color, waiting_for_qr: true }])
        .select()
        .single();

      if (insertError) throw insertError;

      localStorage.setItem('treasure_hunt_team_id', newTeam.id);
      onRegistered(newTeam.id);

    } catch (err) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const theme = PATH_THEMES[color];

  // Render error screen if invalid QR code color
  if (!color && error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
        <div className="w-full max-w-md bg-slate-900/80 border border-red-500/30 rounded-2xl p-6 text-center shadow-xl backdrop-blur-md">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-100 mb-2">Access Error</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <div className="text-xs text-slate-500 bg-slate-950 p-3 rounded-lg border border-slate-800">
            Path QR codes format:<br />
            <code className="text-indigo-400">/start?color=red</code> (or blue, green, etc.)
          </div>
        </div>
      </div>
    );
  }

  // Loading while detecting params
  if (!color) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8">
      {/* Visual background glow */}
      <div 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-20 transition-all duration-500"
        style={{ backgroundColor: `rgb(${theme.rgb})` }}
      />

      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-slate-900 border border-slate-800 mb-3 shadow-inner">
            <Compass 
              className="w-10 h-10 transition-transform duration-700 hover:rotate-180" 
              style={{ color: `rgb(${theme.rgb})` }}
            />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            KRITHOHUNT
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">
            Start Desk QR Scanner
          </p>
        </div>

        {/* Card Container */}
        <div 
          className="bg-slate-900/65 border rounded-3xl p-6 shadow-2xl backdrop-blur-lg glow-active relative overflow-hidden transition-all duration-300"
          style={{ 
            borderColor: `rgba(${theme.rgb}, 0.25)`,
            '--theme-color-rgb': theme.rgb
          }}
        >
          {/* Path Header Indicator */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Path</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest text-slate-950 ${theme.bg}`}>
              {theme.name} PATH
            </span>
          </div>

          <form onSubmit={handleStart} className="space-y-5">
            <div>
              <label htmlFor="teamName" className="block text-xs font-medium text-slate-300 mb-2 uppercase tracking-wide">
                Team Name
              </label>
              <input
                id="teamName"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter team name..."
                maxLength={30}
                required
                className={`w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white text-base outline-none focus:border-slate-700 transition-all ${theme.ring} focus:ring-1`}
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2 items-start">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 px-4 rounded-xl text-slate-950 font-bold text-sm tracking-widest uppercase transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 ${theme.bg} ${theme.hover} disabled:opacity-50`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Start Hunt</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6 px-4">
          By starting, your team progress will be linked to this device. Please use the same phone throughout the hunt.
        </p>
      </div>
    </div>
  );
}

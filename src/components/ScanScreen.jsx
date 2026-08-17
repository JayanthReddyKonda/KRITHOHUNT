import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';

export default function ScanScreen({ teamId, onVerified, onGoToStart }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [teamColor, setTeamColor] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const colorParam = urlParams.get('color') || '';
  const stageParam = parseInt(urlParams.get('stage') || '0', 10);

  useEffect(() => {
    const verifyScannedToken = async () => {
      if (!teamId) {
        setLoading(false);
        return; // Session checks are handled in rendering
      }

      if (!colorParam || !stageParam) {
        setErrorMsg('❌ Missing path color or stage parameters. Please scan a valid location QR code.');
        setLoading(false);
        return;
      }

      try {
        // First fetch team color for styling purposes
        const { data: teamData } = await supabase
          .from('teams')
          .select('color')
          .eq('id', teamId)
          .maybeSingle();

        if (teamData) {
          setTeamColor(teamData.color.toLowerCase());
        }

        // Call database RPC to verify token
        const { data, error } = await supabase.rpc('scan_location_qr', {
          p_team_id: teamId,
          p_scanned_color: colorParam,
          p_scanned_stage: stageParam
        });

        if (error) throw error;

        if (data.success) {
          setSuccessMsg(data.message || '✅ LOCATION VERIFIED! Challenge unlocked.');
        } else {
          setErrorMsg(data.error || '❌ Verification failed. Wrong location.');
        }
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || 'Connection error. Please try scanning again.');
      } finally {
        setLoading(false);
      }
    };

    verifyScannedToken();
  }, [teamId, colorParam, stageParam]);

  // Color theme map for verified screen styling
  const COLOR_THEMES = {
    red: { bg: 'bg-red-500', border: 'border-red-500/20', text: 'text-red-400', hover: 'hover:bg-red-600', rgb: '239, 68, 68' },
    blue: { bg: 'bg-blue-500', border: 'border-blue-500/20', text: 'text-blue-400', hover: 'hover:bg-blue-600', rgb: '59, 130, 246' },
    green: { bg: 'bg-emerald-500', border: 'border-emerald-500/20', text: 'text-emerald-400', hover: 'hover:bg-emerald-600', rgb: '16, 185, 129' },
    yellow: { bg: 'bg-amber-500', border: 'border-amber-500/20', text: 'text-amber-400', hover: 'hover:bg-amber-600', rgb: '245, 158, 11' },
    purple: { bg: 'bg-violet-500', border: 'border-violet-500/20', text: 'text-violet-400', hover: 'hover:bg-violet-600', rgb: '139, 92, 246' },
    orange: { bg: 'bg-orange-500', border: 'border-orange-500/20', text: 'text-orange-400', hover: 'hover:bg-orange-600', rgb: '249, 115, 22' }
  };

  const theme = COLOR_THEMES[teamColor] || COLOR_THEMES.blue;

  // Case A: No team session registered yet
  if (!teamId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <div className="bg-slate-900 border border-slate-850 rounded-3xl p-8 max-w-sm shadow-2xl space-y-6">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto animate-bounce" />
          <h2 className="text-xl font-extrabold text-white">No Active Session</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            You have not registered your team yet. Please meet the organizers at the start desk, select your path, and scan the starting QR code.
          </p>
          <button
            onClick={onGoToStart}
            className="w-full py-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white transition-all"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  // Case B: Verifying token (Loading)
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <div className="space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">Verifying Location QR...</h3>
          <p className="text-[10px] text-slate-500">Checking path parameters database-side</p>
        </div>
      </div>
    );
  }

  // Case C: Verification Success
  if (successMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center relative">
        <div 
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-20 transition-all"
          style={{ backgroundColor: `rgb(${theme.rgb})` }}
        />

        <div className="w-full max-w-sm bg-slate-900/60 border rounded-3xl p-8 shadow-2xl backdrop-blur-lg space-y-6 z-10" style={{ borderColor: `rgba(${theme.rgb}, 0.25)` }}>
          <div className="inline-flex p-4 rounded-full bg-emerald-500/10 border border-emerald-500/25 mb-1 animate-pulse">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black text-white uppercase tracking-wider">
              ✅ LOCATION VERIFIED
            </h1>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
              Challenge unlocked!
            </p>
          </div>

          <button
            onClick={onVerified}
            style={{ backgroundColor: `rgba(${theme.rgb}, 0.95)` }}
            className={`w-full py-4 rounded-xl text-slate-950 font-black text-xs tracking-wider uppercase transition-all shadow-lg active:scale-95 ${theme.hover}`}
          >
            START GAME
          </button>
        </div>
      </div>
    );
  }

  // Case D: Verification Failed (Error)
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center relative">
      <div className="w-full max-w-sm bg-slate-900/60 border border-red-500/20 rounded-3xl p-8 shadow-2xl backdrop-blur-lg space-y-6">
        <div className="inline-flex p-4 rounded-full bg-red-500/10 border border-red-500/25 mb-1">
          <XCircle className="w-12 h-12 text-red-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-white uppercase tracking-wider">
            ❌ WRONG QR
          </h1>
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest">
            {errorMsg.includes('path') ? 'Wrong Path' : 'Wrong Location'}
          </p>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed px-2">
          This is not the correct location. Check your clue and try again.
        </p>

        <button
          onClick={onVerified} // Redirects to play screen to check clue instruction
          className="w-full py-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 transition-all active:scale-95"
        >
          SCAN AGAIN
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import GameRenderer from './GameRenderer';
import { Html5Qrcode } from 'html5-qrcode';
import { Compass, Trophy, Clock, Skull, RefreshCw, LogOut, Loader2, MapPin, CheckCircle, Camera, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

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
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scannerSuccess, setScannerSuccess] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState(null); // { success: boolean, message: string }

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

  useEffect(() => {
    let html5QrCode;
    if (showScanner && !scannerSuccess && !verifying) {
      setScannerError('');
      const timer = setTimeout(() => {
        try {
          html5QrCode = new Html5Qrcode("reader");
          const qrCodeSuccessCallback = async (decodedText) => {
            setVerifying(true);
            try {
              await html5QrCode.stop();
            } catch (err) {
              console.error("Failed to stop scanner", err);
            }

            let color = '';
            let stage = 0;
            try {
              const url = new URL(decodedText);
              color = url.searchParams.get('color') || '';
              stage = parseInt(url.searchParams.get('stage') || '0', 10);
            } catch (e) {
              const search = decodedText.includes('?') ? decodedText.substring(decodedText.indexOf('?')) : '?' + decodedText;
              const params = new URLSearchParams(search);
              color = params.get('color') || '';
              stage = parseInt(params.get('stage') || '0', 10);
            }

            if (!color || !stage) {
              setVerificationFeedback({
                success: false,
                message: '❌ Invalid QR Code. This is not a valid location QR code.'
              });
              setVerifying(false);
              return;
            }

            try {
              const { data, error: rpcError } = await supabase.rpc('scan_location_qr', {
                p_team_id: teamId,
                p_scanned_color: color,
                p_scanned_stage: stage
              });

              if (rpcError) throw rpcError;

              if (data.success) {
                setScannerSuccess(true);
                setVerificationFeedback({
                  success: true,
                  message: data.message || '✅ LOCATION VERIFIED! Challenge unlocked.'
                });
              } else {
                setVerificationFeedback({
                  success: false,
                  message: data.error || '❌ WRONG QR. This is not the correct location for your current clue.'
                });
              }
            } catch (err) {
              console.error(err);
              setVerificationFeedback({
                success: false,
                message: err.message || 'Connection error. Please try again.'
              });
            } finally {
              setVerifying(false);
            }
          };

          const config = { fps: 10, qrbox: { width: 220, height: 220 } };
          html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
            .catch((err) => {
              console.error(err);
              setScannerError('Camera access denied or could not find environment camera. Please allow camera permissions.');
            });
        } catch (e) {
          console.error(e);
          setScannerError('Failed to initialize scanner component.');
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch((e) => console.error("Cleanup stop failed", e));
        }
      };
    }
  }, [showScanner, scannerSuccess, verifying, teamId, team?.color, team?.clues_solved]);

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

          {/* Current Location Clue or Game Challenge */}
          {team.waiting_for_qr ? (
            <div className="space-y-6 py-2 animate-fade-in">
              {/* Clue Header & Text */}
              <div className="p-5 bg-slate-900 border border-slate-850 rounded-2xl text-left space-y-4">
                <div>
                  <span className="text-[10px] font-black tracking-widest uppercase text-indigo-400">
                    CLUE {team.clues_solved + 1}
                  </span>
                  <p className="text-sm text-slate-200 leading-relaxed font-semibold mt-1">
                    {clue ? clue.clue_text : 'Find the next physical location.'}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold uppercase">
                  <MapPin className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <span>📍 Find the location described above.</span>
                </div>
              </div>

              {/* Lock card and Scanner trigger */}
              <div className="p-6 bg-slate-950/60 rounded-2xl border border-indigo-500/10 text-center space-y-4">
                <button
                  onClick={() => setShowScanner(true)}
                  style={{ backgroundColor: `rgba(${theme.rgb}, 0.95)` }}
                  className="w-full py-4 text-slate-950 font-black text-sm tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg hover:brightness-110 cursor-pointer"
                >
                  <Camera className="w-4.5 h-4.5 text-slate-955" style={{ color: `rgb(${theme.rgb})` }} />
                  <span>📷 SCAN QR</span>
                </button>

                <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Game {team.clues_solved + 1} is locked until you scan the QR at the correct location.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 text-slate-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 px-3.5">
                <MapPin className="w-3.5 h-3.5" style={{ color: `rgb(${theme.rgb})` }} />
                <span>Active Location Verified</span>
              </div>

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
            </div>
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

      {/* QR Scanner Modal Overlay */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in no-print">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
            
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white flex items-center justify-center gap-2">
                <Camera className="w-5 h-5 text-indigo-400" />
                <span>📷 QR Code Scanner</span>
              </h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                Point at the physical location poster
              </p>
            </div>

            {/* Viewport/States */}
            <div className="relative">
              {/* Camera Scanner Viewport */}
              {!scannerError && !verifying && !verificationFeedback && (
                <div className="relative aspect-square max-w-[260px] mx-auto rounded-2xl border border-slate-800 overflow-hidden bg-black shadow-inner">
                  <div id="reader" className="w-full h-full" />
                  {/* Scanner overlay target box */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-dashed border-indigo-400/50 rounded-lg animate-pulse" />
                  </div>
                </div>
              )}

              {/* Verifying state */}
              {verifying && (
                <div className="aspect-square max-w-[260px] mx-auto flex flex-col items-center justify-center gap-3 bg-slate-950/40 rounded-2xl border border-slate-850">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <span className="text-xs text-slate-400">Verifying scanned token...</span>
                </div>
              )}

              {/* Error initializing state */}
              {scannerError && !verificationFeedback && (
                <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-center space-y-4 max-w-[260px] mx-auto">
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto animate-bounce" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Scanner Locked</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {scannerError}
                    </p>
                  </div>
                  {/* Web Testing Sandbox Fallback */}
                  <div className="pt-2 border-t border-slate-850 space-y-2">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Development Sandbox</span>
                    <button
                      onClick={async () => {
                        setVerifying(true);
                        try {
                          const { data, error: rpcError } = await supabase.rpc('scan_location_qr', {
                            p_team_id: teamId,
                            p_scanned_color: team.color.toLowerCase(),
                            p_scanned_stage: team.clues_solved + 1
                          });
                          if (rpcError) throw rpcError;
                          if (data.success) {
                            setScannerSuccess(true);
                            setVerificationFeedback({
                              success: true,
                              message: '✅ LOCATION VERIFIED! Challenge unlocked.'
                            });
                          } else {
                            setVerificationFeedback({
                              success: false,
                              message: data.error || '❌ WRONG QR. This is not the correct location.'
                            });
                          }
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setVerifying(false);
                        }
                      }}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      Bypass & Scan Correct QR (Simulated)
                    </button>
                  </div>
                </div>
              )}

              {/* Scan feedback (Success / Fail) */}
              {verificationFeedback && (
                <div className="p-5 rounded-2xl text-center space-y-4 max-w-[260px] mx-auto bg-slate-950/40 border border-slate-850">
                  {verificationFeedback.success ? (
                    <>
                      <div className="inline-block p-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Location Verified</h4>
                        <p className="text-[11px] text-slate-300 font-medium">Challenge unlocked!</p>
                      </div>
                      <button
                        onClick={async () => {
                          setShowScanner(false);
                          setScannerSuccess(false);
                          setVerificationFeedback(null);
                          await fetchGameState();
                        }}
                        style={{ backgroundColor: `rgba(${theme.rgb}, 0.95)` }}
                        className="w-full py-2.5 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        Start Challenge
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="inline-block p-2 rounded-full bg-red-500/10 border border-red-500/20">
                        <XCircle className="w-8 h-8 text-red-500 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Wrong Location</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          This QR code does not match your current clue.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setVerificationFeedback(null);
                          setScannerSuccess(false);
                          setScannerError('');
                        }}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer"
                      >
                        Scan Again
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Cancel Button */}
            {(!verificationFeedback || !verificationFeedback.success) && (
              <button
                onClick={() => {
                  setShowScanner(false);
                  setScannerSuccess(false);
                  setVerificationFeedback(null);
                }}
                className="w-full py-3 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-400 hover:text-slate-300 font-bold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer"
              >
                Cancel Scanner
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

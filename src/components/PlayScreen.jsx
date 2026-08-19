import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import GameRenderer from './GameRenderer';
import { Html5Qrcode } from 'html5-qrcode';
import { Trophy, Clock, Skull, RefreshCw, Loader2, MapPin, CheckCircle, Camera, AlertTriangle, CheckCircle2, XCircle, ChevronLeft } from 'lucide-react';
import { Card, Button, BottomSheet } from '@/components/primitives';

const PATH_THEMES = {
  red: { name: 'RED', accent: 'rose', badgeClass: 'path-badge-rose' },
  blue: { name: 'BLUE', accent: 'cyan', badgeClass: 'path-badge-cyan' },
  green: { name: 'GREEN', accent: 'emerald', badgeClass: 'path-badge-emerald' },
  yellow: { name: 'YELLOW', accent: 'amber', badgeClass: 'path-badge-amber' },
  purple: { name: 'PURPLE', accent: 'violet', badgeClass: 'path-badge-violet' },
  orange: { name: 'ORANGE', accent: 'orange', badgeClass: 'path-badge-orange' },
};

const PUBLIC_QR_ORIGIN = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');

const withTimeout = (promise, message) => Promise.race([
  promise,
  new Promise((_, reject) => window.setTimeout(() => reject(new Error(message)), 10000)),
]);

export default function PlayScreen({ teamId, onReset }) {
  const [team, setTeam] = useState(null);
  const [clue, setClue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [cameraPermission, setCameraPermission] = useState('idle');
  const [scannerSuccess, setScannerSuccess] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState(null);
  const html5QrCodeRef = useRef(null);
  const scanRequestRef = useRef(0);
  
  const [timeLeft, setTimeLeft] = useState('');
  const [timerAlert, setTimerAlert] = useState('normal'); // 'normal', 'warning', 'critical'

  const fetchGameState = useCallback(async (isRefresh = false) => {
    const requestId = ++scanRequestRef.current;
    if (isRefresh) setRefreshing(true);
    try {
      setError('');
      await withTimeout(supabase.rpc('expire_overdue_teams'), 'The game server did not respond. Run the latest Supabase migration and try again.').catch(() => null);
      const { data: teamData, error: teamError } = await withTimeout(supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle(), 'The game server did not respond. Check Supabase configuration and try again.');

      if (teamError) throw teamError;

      if (!teamData) {
        localStorage.removeItem('treasure_hunt_team_id');
        onReset();
        return;
      }

      if (requestId !== scanRequestRef.current) return;
      setTeam(teamData);

      if (teamData.clues_solved < 5) {
        const { data: clueData, error: clueError } = await withTimeout(
          supabase.rpc('get_current_clue', { p_team_id: teamId }),
          'The current clue RPC is unavailable. Run the latest Supabase migration.'
        );

        if (clueError) throw clueError;
        if (requestId === scanRequestRef.current) setClue(clueData && clueData.length > 0 ? clueData[0] : null);
      } else {
        setClue(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch game state. Please check your network connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId, onReset]);

  const isAwaitingFinish = team?.clues_solved === 5 && !team?.finish_time;

  useEffect(() => {
    fetchGameState();

    let intervalId;
    if (isAwaitingFinish) {
      intervalId = setInterval(() => fetchGameState(false), 10000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchGameState, isAwaitingFinish]);

  useEffect(() => {
    if (!team?.start_time || team?.finish_time || team?.closed_at) {
      setTimeLeft('');
      return;
    }

    const updateTimer = () => {
      const startTime = new Date(team.start_time).getTime();
      const limitMs = 45 * 60 * 1000;
      const elapsedMs = Date.now() - startTime;
      const remainingMs = Math.max(0, limitMs - elapsedMs);

      if (remainingMs <= 0) {
        setTimeLeft('00:00');
        setTimerAlert('critical');
        return;
      }

      const totalSecs = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSecs / 60);
      const seconds = totalSecs % 60;

      const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setTimeLeft(formatted);

      if (minutes < 5) {
        setTimerAlert('critical');
      } else if (minutes < 10) {
        setTimerAlert('warning');
      } else {
        setTimerAlert('normal');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [team?.start_time, team?.finish_time, team?.closed_at]);

  // QR Scanner effect using BottomSheet
  useEffect(() => {
    let html5QrCode;
    if (showScanner && cameraPermission === 'granted' && !scannerSuccess && !verifying && !verificationFeedback) {
      setScannerError('');
      const timer = setTimeout(async () => {
        try {
          html5QrCode = new Html5Qrcode("qr-reader");
          html5QrCodeRef.current = html5QrCode;
          let scanHandled = false;

          const qrCodeSuccessCallback = async (decodedText) => {
            if (scanHandled) return;
            scanHandled = true;
            setVerifying(true);
            try {
              await html5QrCode.stop();
            } catch (err) {
              console.error("Failed to stop scanner", err);
            }

            let token = '';
            let isValidUrl = false;
            try {
              const url = new URL(decodedText);
              const normalizedPath = url.pathname.replace(/\/$/, '');

              if ([window.location.origin, PUBLIC_QR_ORIGIN].includes(url.origin) && normalizedPath === '/scan') {
                isValidUrl = true;
              }
              token = url.searchParams.get('token') || '';

              // Fallback: some mobile QR scanners may put query params in the pathname
              if (!token && decodedText.includes('token=')) {
                const match = decodedText.match(/token=([a-f0-9]{36})/i);
                if (match) {
                  token = match[1];
                  isValidUrl = true;
                }
              }
            } catch {
              isValidUrl = false;
            }

            if (!isValidUrl || !/^[a-f0-9]{36}$/.test(token)) {
              setVerificationFeedback({
                success: false,
                message: 'Invalid QR Code. This is not a valid location QR code.'
              });
              setVerifying(false);
              return;
            }

            try {
              const { data, error: rpcError } = await supabase.rpc('scan_location_qr', {
                p_team_id: teamId,
                p_token: token
              });

              if (rpcError) throw rpcError;

              if (data?.success === true) {
                setScannerSuccess(true);
                setVerificationFeedback({
                  success: true,
                  message: data.message || 'LOCATION VERIFIED! Challenge unlocked.'
                });
              } else {
                setVerificationFeedback({
                  success: false,
                  message: data.error || 'WRONG QR. This is not the correct location for your current clue.'
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
          await html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback);
        } catch (e) {
          console.error(e);
          setScannerPermissionError(e);
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch((e) => console.error("Cleanup stop failed", e));
        }
      };
    }
  }, [showScanner, cameraPermission, scannerSuccess, verifying, verificationFeedback, teamId, team?.color, team?.clues_solved]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => { });
      }
    };
  }, []);

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

  const setScannerPermissionError = (error) => {
    const reason = error?.name;
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setScannerError('Camera access requires HTTPS. Open the deployed HTTPS address on this phone.');
    } else if (reason === 'NotAllowedError' || reason === 'SecurityError') {
      setScannerError('Camera permission is blocked. Allow camera access in your browser site settings, then tap Try Again.');
    } else if (reason === 'NotFoundError') {
      setScannerError('No camera was found on this device.');
    } else {
      setScannerError('Camera could not start. Check that another app is not using it, then try again.');
    }
    setCameraPermission('denied');
  };

  const requestCameraPermission = async () => {
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setScannerError('Camera access requires HTTPS. Open the deployed HTTPS address on this phone.');
      setCameraPermission('denied');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError('This browser does not support camera access. Use current Chrome or Safari.');
      setCameraPermission('denied');
      return;
    }

    setCameraPermission('requesting');
    setScannerError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      stream.getTracks().forEach((track) => track.stop());
      setCameraPermission('granted');
    } catch (error) {
      setScannerPermissionError(error);
    }
  };

  const handleOpenScanner = () => {
    setShowScanner(true);
    requestCameraPermission();
  };

  const handleCloseScanner = () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().catch(() => { });
    }
    setShowScanner(false);
    setScannerSuccess(false);
    setVerificationFeedback(null);
    setScannerError('');
    setCameraPermission('idle');
  };

  const handleStartChallenge = async () => {
    setShowScanner(false);
    setScannerSuccess(false);
    setVerificationFeedback(null);
    await fetchGameState();
  };

  const handleScanAgain = () => {
    if (html5QrCodeRef.current?.isScanning) {
      html5QrCodeRef.current.stop().catch(() => { });
    }
    setVerificationFeedback(null);
    setScannerSuccess(false);
    setScannerError('');
    if (cameraPermission !== 'granted') requestCameraPermission();
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[80vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: `hsl(var(--accent-brand))` }} />
        <span className="text-caption text-muted">Loading game progress...</span>
      </div>
    );
  }

  if (!team && error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <Card variant="elevated" className="w-full max-w-sm p-6 text-center">
          <p className="text-feedback-error text-body-sm mb-4">{error}</p>
          <Button variant="secondary" size="md" onClick={() => fetchGameState()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (team?.closed_at && !team.finish_time) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4 py-8 text-center">
        <Card variant="elevated" className="w-full max-w-sm p-6 space-y-5">
          <Clock className="w-12 h-12 text-feedback-warning mx-auto" />
          <h1 className="text-h1 font-semibold text-primary">Game closed</h1>
          <p className="text-body-sm text-secondary">This team session is closed{team.close_reason === 'time_limit' ? ' because the 45-minute limit ended.' : ' by the organiser.'}</p>
          <p className="text-caption text-muted">Your progress is saved and remains visible to the organiser.</p>
          <Button variant="secondary" size="lg" fullWidth onClick={onReset}>Return to Start</Button>
        </Card>
      </div>
    );
  }

  const theme = PATH_THEMES[team.color.toLowerCase()] || PATH_THEMES.red;
  const progressPercent = ((team.clues_solved + (team.waiting_for_qr ? 0 : 1)) / 5) * 100;

  // SCREEN A: Treasure Hunt Complete (Finished State)
  if (team.finish_time) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none" style={{ backgroundColor: `hsl(var(--feedback-success) / 0.2)` }} />

        <Card variant="elevated" className="w-full max-w-[360px] text-center p-6">
          <div className="inline-flex p-4 rounded-full bg-feedback-success/10 border border-feedback-success/25 mb-4 shadow-lg animate-bounce">
            <Trophy className="w-12 h-12 text-feedback-success" />
          </div>

          <h1 className="text-h1 font-semibold text-primary tracking-tight leading-none mb-1">Congratulations!</h1>
          <p className="text-caption font-medium text-feedback-success uppercase tracking-wide mb-6">Treasure hunt complete</p>

          <div className="space-y-4 text-left">
            <div className="flex justify-between items-center pb-3 border-b border-border-subtle">
              <span className="text-body-sm text-secondary">Team Name</span>
              <span className="text-body-sm font-semibold text-primary">{team.name}</span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-border-subtle">
              <span className="text-body-sm text-secondary">Path Color</span>
              <span className={`path-badge ${theme.badgeClass} px-2 py-0.5 rounded text-micro font-semibold uppercase`}>
                {theme.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-surface-2 border border-border-subtle p-4 rounded-2xl flex flex-col items-center justify-center">
                <Clock className="w-5 h-5 text-accent-brand mb-1" />
                <span className="text-micro uppercase font-medium tracking-wide text-muted">Time Taken</span>
                <span className="text-body font-semibold text-primary mt-0.5">{getDurationText(team.start_time, team.finish_time)}</span>
              </div>

              <div className="bg-surface-2 border border-border-subtle p-4 rounded-2xl flex flex-col items-center justify-center">
                <Skull className="w-5 h-5 text-feedback-warning mb-1" />
                <span className="text-micro uppercase font-medium tracking-wide text-muted">Penalties</span>
                <span className="text-body font-semibold text-primary mt-0.5">{team.penalty_count}</span>
              </div>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="mt-8 text-micro underline underline-offset-2" onClick={() => { localStorage.removeItem('treasure_hunt_team_id'); onReset(); }}>
            Start New Game / Scan New Path
          </Button>
        </Card>
      </div>
    );
  }

  // SCREEN B: Waiting for Organizer to Mark Finished (Clues solved = 5)
  if (team.clues_solved === 5) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none" style={{ backgroundColor: `hsl(var(--accent-brand) / 0.2)` }} />

        <Card variant="elevated" className="w-full max-w-[360px] p-6 text-center space-y-6">
          <div className="inline-flex p-3 rounded-full bg-surface-1 border border-border-subtle mb-3 shadow-inner">
            <CheckCircle className="w-8 h-8 text-accent-brand" />
          </div>
          <h1 className="text-h2 font-semibold text-primary">All digital challenges complete!</h1>

          <p className="text-body-sm text-secondary leading-relaxed">
            Your final challenge is physical and awaits you at the <strong className="text-primary">START DESK</strong>.
          </p>

          <div className="p-4 bg-surface-2 rounded-2xl border border-border-subtle text-left">
            <h4 className="text-caption font-semibold uppercase tracking-wide text-muted mb-1.5">Your Instruction:</h4>
            <p className="text-caption text-muted leading-relaxed">
              Organizers will hand you a <strong className="text-accent-brand">9-piece club logo jigsaw puzzle</strong>. Assemble it correctly, and the organizer will verify your finish to record your final score.
            </p>
          </div>

          <div className="pt-2 border-t border-border-subtle flex flex-col gap-3">
            <Button variant="primary" size="lg" fullWidth onClick={() => fetchGameState(true)} disabled={refreshing} loading={refreshing}>
              {refreshing ? 'Checking...' : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Check If Organizer Marked Finished</span>
                </>
              )}
            </Button>
            <p className="text-micro text-muted">Screen auto-refreshes every 10 seconds</p>
          </div>
        </Card>
      </div>
    );
  }

  // SCREEN C: Active Gameplay Clue Screen (clues_solved < 5)
  return (
    <div className="flex flex-col min-h-screen relative">
      {/* Background radial glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none transition-all duration-500 -z-10"
        style={{ backgroundColor: `hsl(var(--accent-${theme.accent}) / 0.05)` }}
      />

      {/* Sticky Header - 48px height, surface-0/80 + blur */}
      <header className="sticky top-0 z-40 h-[48px] flex items-center justify-between px-4 bg-surface-0/80 backdrop-blur-md border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" aria-label="Back to start" onClick={handleLogout}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <span className="text-micro text-muted uppercase tracking-wide font-medium truncate max-w-[120px] xs:max-w-[160px]">{team.name} · ID {team.team_code || '-----'}</span>
            <span className={`path-badge ${theme.badgeClass} px-2 py-0.5 rounded text-micro font-medium uppercase inline-block w-fit`}>
              {theme.name} Path
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {timeLeft && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-micro font-medium uppercase tracking-wide ${
              timerAlert === 'critical'
                ? 'bg-feedback-error/15 border border-feedback-error text-feedback-error animate-pulse'
                : timerAlert === 'warning'
                  ? 'bg-feedback-warning/15 border border-feedback-warning text-feedback-warning'
                  : 'bg-surface-2 border border-border-subtle text-secondary'
            }`}>
              <Clock className="w-3 h-3" />
              <span>{timeLeft}</span>
            </div>
          )}

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-micro font-medium text-muted uppercase tracking-wide">STAGE</span>
            <span className="text-caption font-semibold text-primary">0{team.clues_solved + 1} / 05</span>
          </div>

          <Button variant="ghost" size="sm" aria-label="Sync game state" onClick={() => fetchGameState(true)} disabled={refreshing} loading={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* Main Game Container */}
      <main className="flex-1 overflow-y-auto px-3 py-3 pb-6">
        <div className="w-full max-w-md mx-auto">
          {/* Game Card */}
          <Card variant="elevated" padding="none" className="relative overflow-hidden">
            {/* Compact Step Progress Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-1/50">
              {[1, 2, 3, 4, 5].map((step) => {
                const isCompleted = step <= team.clues_solved;
                const isActive = step === team.clues_solved + 1;
                return (
                  <React.Fragment key={step}>
                    <div className="flex items-center justify-center">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-all duration-300 ${
                          isCompleted
                            ? 'bg-feedback-success/15 border-feedback-success text-feedback-success'
                            : isActive
                              ? 'text-primary'
                              : 'border-border-strong bg-surface-3 text-muted'
                        }`}
                        style={isActive ? { borderColor: `hsl(var(--accent-${theme.accent}))`, color: `hsl(var(--accent-${theme.accent}))` } : {}}
                      >
                        {isCompleted ? '✓' : step}
                      </div>
                    </div>
                    {step < 5 && (
                      <div className={`flex-1 h-px mx-1.5 rounded-full transition-all duration-500 ${
                        step <= team.clues_solved
                          ? 'bg-feedback-success/45'
                          : 'bg-border-strong'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="p-3 sm:p-4 space-y-4">
              {/* Current Location Clue or Game Challenge */}
              {team.waiting_for_qr ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: `hsl(var(--accent-${theme.accent}))` }}>
                      Stage {team.clues_solved + 1} of 5
                    </span>
                    <h2 className="text-[1.1rem] font-semibold text-primary tracking-tight leading-tight">Next Location</h2>
                  </div>

                  <div className="bg-surface-2/40 border border-border-subtle rounded-xl p-3.5 text-left space-y-2">
                    <p className="text-[0.875rem] text-primary leading-relaxed">
                      {clue ? clue.clue_text : 'Find the next physical location.'}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted font-medium uppercase tracking-wide pt-2 border-t border-border-subtle/50">
                      <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>Find and scan the QR at this location.</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={handleOpenScanner}
                      className="touch-target"
                    >
                      <Camera className="w-4 h-4 text-inverse" />
                      <span>Scan Location QR</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="p-3 bg-surface-2/65 rounded-xl border border-border-subtle text-caption font-medium uppercase tracking-wide flex items-center gap-1.5 w-fit">
                    <MapPin className="w-3.5 h-3.5" style={{ color: `hsl(var(--accent-${theme.accent}))` }} />
                    <span>Location Verified</span>
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
              <div className="pt-3 border-t border-border-subtle flex justify-between text-[11px] font-medium uppercase tracking-wide">
                <span className="flex items-center gap-1 text-muted">
                  <Skull className="w-3 h-3 text-feedback-warning" />
                  <span>Penalties: {team.penalty_count}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchGameState(true)}
                  disabled={refreshing}
                  loading={refreshing}
                  className="text-secondary hover:text-primary"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* QR Scanner BottomSheet — compact mobile layout */}
      <BottomSheet
        isOpen={showScanner}
        onClose={handleCloseScanner}
        title={null}
        showCloseButton={false}
        size="full"
        className=""
      >
        <div className="space-y-3">
          {/* Compact scanner header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4" style={{ color: `hsl(var(--accent-${theme.accent}))` }} />
              <span className="text-[0.875rem] font-semibold text-primary">Scan Location QR</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCloseScanner} aria-label="Close scanner">
              <span className="text-[0.75rem] text-muted">Cancel</span>
            </Button>
          </div>

          {/* Camera Viewport — square aspect for portrait mobile */}
          <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden border border-border-subtle max-h-[55vh]">
            {/* Camera feed */}
            {cameraPermission === 'granted' && !scannerError && !verifying && !verificationFeedback && (
              <>
                <div id="qr-reader" className="w-full h-full" />
                {/* Corner bracket overlay */}
                <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                  <div className="absolute top-5 left-5 w-10 h-10 border-t-2 border-l-2" style={{ borderColor: `hsl(var(--accent-${theme.accent}))` }} />
                  <div className="absolute top-5 right-5 w-10 h-10 border-t-2 border-r-2" style={{ borderColor: `hsl(var(--accent-${theme.accent}))` }} />
                  <div className="absolute bottom-5 left-5 w-10 h-10 border-b-2 border-l-2" style={{ borderColor: `hsl(var(--accent-${theme.accent}))` }} />
                  <div className="absolute bottom-5 right-5 w-10 h-10 border-b-2 border-r-2" style={{ borderColor: `hsl(var(--accent-${theme.accent}))` }} />
                </div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-white/60 font-medium">
                  Align QR inside the frame
                </div>
              </>
            )}

            {cameraPermission === 'requesting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-0/95 p-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent-brand" />
                <p className="text-[0.875rem] font-semibold text-primary">Requesting camera access…</p>
                <p className="text-[0.75rem] text-secondary">Tap Allow in the browser prompt.</p>
              </div>
            )}

            {verifying && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-0/90 backdrop-blur-sm">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: `hsl(var(--accent-brand))` }} />
                <span className="text-[0.75rem] text-secondary">Verifying…</span>
              </div>
            )}

            {scannerError && cameraPermission === 'denied' && !verificationFeedback && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 bg-surface-0/95 text-center">
                <AlertTriangle className="w-9 h-9 text-feedback-error" />
                <p className="text-[0.75rem] font-semibold text-feedback-error">Camera blocked</p>
                <p className="text-[0.7rem] text-muted">{scannerError}</p>
                <Button variant="primary" size="md" onClick={requestCameraPermission}>Try Again</Button>
              </div>
            )}

            {verificationFeedback && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 bg-surface-0/95 backdrop-blur-sm text-center">
                {verificationFeedback.success ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-feedback-success" />
                    <div>
                      <p className="text-[0.875rem] font-semibold text-feedback-success">Location verified!</p>
                      <p className="text-[0.75rem] text-secondary mt-0.5">Challenge unlocked</p>
                    </div>
                    <Button variant="primary" size="lg" fullWidth onClick={handleStartChallenge}>Start Challenge</Button>
                  </>
                ) : (
                  <>
                    <XCircle className="w-10 h-10 text-feedback-error" />
                    <div>
                      <p className="text-[0.875rem] font-semibold text-feedback-error">Wrong location</p>
                      <p className="text-[0.75rem] text-muted mt-0.5">This QR doesn't match your clue.</p>
                    </div>
                    <Button variant="secondary" size="md" fullWidth onClick={handleScanAgain}>Scan Again</Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Cancel — only when not in success state */}
          {(!verificationFeedback || !verificationFeedback.success) && (
            <Button variant="secondary" size="md" fullWidth onClick={handleCloseScanner}>
              Cancel
            </Button>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
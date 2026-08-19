import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import GameRenderer from './GameRenderer';
import { Html5Qrcode } from 'html5-qrcode';
import { Trophy, Clock, Skull, RefreshCw, Loader2, MapPin, CheckCircle, Camera, AlertTriangle, CheckCircle2, XCircle, ChevronLeft, X } from 'lucide-react';
import { Card, Button, BottomSheet } from '@/components/primitives';

const PATH_BADGES = {
  red: { badgeClass: 'path-badge-rose', dotClass: 'bg-rose-500' },
  blue: { badgeClass: 'path-badge-cyan', dotClass: 'bg-cyan-400' },
  green: { badgeClass: 'path-badge-emerald', dotClass: 'bg-emerald-400' },
  yellow: { badgeClass: 'path-badge-amber', dotClass: 'bg-amber-400' },
  purple: { badgeClass: 'path-badge-violet', dotClass: 'bg-violet-400' },
  orange: { badgeClass: 'path-badge-orange', dotClass: 'bg-orange-400' },
};

const withTimeout = (promise, message) => Promise.race([
  Promise.resolve(promise),
  new Promise((_, reject) => window.setTimeout(() => reject(new Error(message)), 10000)),
]);

const getElapsedDurationText = (start, finish) => {
  if (!start) return 'N/A';
  const startTime = new Date(start).getTime();
  const finishTime = finish ? new Date(finish).getTime() : Date.now();
  const diffSecs = Math.max(0, Math.floor((finishTime - startTime) / 1000));
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  return `${mins}m ${secs}s`;
};

export default function PlayScreen({ teamId, onReset }) {
  const [team, setTeam] = useState(null);
  const [clue, setClue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [cameraPermission, setCameraPermission] = useState('idle');
  const [verifying, setVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState(null);
  const html5QrCodeRef = useRef(null);
  const scanRequestRef = useRef(0);

  const [timeLeft, setTimeLeft] = useState('');
  const [timerAlert, setTimerAlert] = useState('normal');

  // Basic Black and Blue Theme for Gameplay
  const theme = {
    name: 'Default',
    accent: 'cyan',
    badgeClass: 'path-badge-cyan',
    themeColor: 'hsl(var(--accent-cyan))',
    bgGlow: 'hsl(var(--accent-cyan) / 0.18)',
    borderColor: 'hsl(var(--accent-cyan) / 0.35)',
  };

  const fetchGameState = useCallback(async (isRefresh = false) => {
    const requestId = ++scanRequestRef.current;
    if (isRefresh) setRefreshing(true);
    try {
      setError('');
      await withTimeout(supabase.rpc('expire_overdue_teams'), 'Server error. Try again.').catch(() => null);
      const { data: teamData, error: teamError } = await withTimeout(supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle(), 'Check network and Supabase configuration.');

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
          'Clue RPC unavailable.'
        );

        if (clueError) throw clueError;
        if (requestId === scanRequestRef.current) setClue(clueData && clueData.length > 0 ? clueData[0] : null);
      } else {
        setClue(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch game state. Please check connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId, onReset]);

  useEffect(() => {
    fetchGameState();
  }, [fetchGameState]);

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
      setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);

      if (minutes < 5) {
        setTimerAlert('critical');
      } else if (minutes < 15) {
        setTimerAlert('warning');
      } else {
        setTimerAlert('normal');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [team]);

  const handleLogout = () => {
    if (window.confirm('Leave current session and return to menu? Progress is saved.')) {
      localStorage.removeItem('treasure_hunt_team_id');
      onReset();
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
      html5QrCodeRef.current = null;
    }
  };

  const handleScanSuccess = async (decodedText) => {
    await stopCamera();
    setVerifying(true);

    try {
      let token = decodedText.trim();
      if (token.includes('token=')) {
        const urlObj = new URL(token.startsWith('http') ? token : `https://dummy.com/${token}`);
        token = urlObj.searchParams.get('token') || token;
      }

      const { data, error: rpcError } = await supabase.rpc('scan_location_qr', {
        p_team_id: teamId,
        p_token: token,
      });

      if (rpcError) throw rpcError;

      if (data?.success) {
        setVerificationFeedback({ success: true, message: data.message || 'Location verified!' });
      } else {
        setVerificationFeedback({ success: false, error: data?.error || 'Wrong QR location scanned.' });
      }
    } catch (err) {
      setVerificationFeedback({ success: false, error: err.message || 'Verification error' });
    } finally {
      setVerifying(false);
    }
  };

  const requestCameraPermission = async () => {
    setCameraPermission('requesting');
    setScannerError('');
    setVerificationFeedback(null);

    try {
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        throw new Error('Camera access requires HTTPS or localhost connection.');
      }

      await stopCamera();

      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 200, height: 200 },
        aspectRatio: 1.0,
      };

      // Try environment (rear) camera, fallback to user (front) or any available camera
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          handleScanSuccess,
          () => { }
        );
      } catch (firstErr) {
        console.warn('Rear camera unavailable, trying front camera:', firstErr);
        try {
          await html5QrCode.start(
            { facingMode: 'user' },
            config,
            handleScanSuccess,
            () => { }
          );
        } catch (secondErr) {
          const devices = await Html5Qrcode.getCameras().catch(() => []);
          if (devices && devices.length > 0) {
            await html5QrCode.start(
              devices[0].id,
              config,
              handleScanSuccess,
              () => { }
            );
          } else {
            throw secondErr || firstErr;
          }
        }
      }

      setCameraPermission('granted');
    } catch (err) {
      console.error('Camera error:', err);
      setCameraPermission('denied');
      setScannerError(err.message || 'Camera blocked or unavailable on this device.');
    }
  };

  const handleOpenScanner = () => {
    setShowScanner(true);
    setVerificationFeedback(null);
    setTimeout(() => {
      requestCameraPermission();
    }, 150);
  };

  const handleCloseScanner = () => {
    stopCamera();
    setShowScanner(false);
    setCameraPermission('idle');
    setVerificationFeedback(null);
  };

  const handleStartChallenge = () => {
    handleCloseScanner();
    fetchGameState(true);
  };

  const handleScanAgain = () => {
    setVerificationFeedback(null);
    requestCameraPermission();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent-brand" />
        <p className="text-body-sm text-secondary font-medium">Loading game session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-4">
        <Card variant="elevated" className="w-full max-w-[420px] text-center p-6 space-y-4">
          <AlertTriangle className="w-10 h-10 text-feedback-error mx-auto" />
          <h2 className="text-h2 font-semibold text-primary">Connection error</h2>
          <p className="text-caption text-muted leading-relaxed">{error}</p>
          <Button variant="primary" size="md" fullWidth onClick={() => fetchGameState(true)}>
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  if (!team) return null;

  // GAME COMPLETED / FINISHED / CLOSED SCREEN
  if (team.finish_time || team.clues_solved >= 5 || team.closed_at) {
    const isCompleted = Boolean(team.finish_time || team.clues_solved >= 5);
    const durationText = getElapsedDurationText(team.start_time, team.finish_time);

    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full blur-[120px] pointer-events-none opacity-25 bg-accent-brand" />

        <Card
          variant="elevated"
          className="w-full max-w-[460px] sm:max-w-[480px] p-6 sm:p-8 text-center space-y-6 relative z-10 border border-border-subtle shadow-2xl rounded-2xl bg-surface-1/90 backdrop-blur-xl"
        >
          <div className="inline-flex p-4 rounded-full bg-surface-2 border border-border-subtle shadow-inner mx-auto">
            {isCompleted ? (
              <Trophy className="w-12 h-12 text-accent-brand animate-bounce" />
            ) : (
              <Skull className="w-12 h-12 text-feedback-error" />
            )}
          </div>

          <div className="space-y-1.5">
            <h1 className="text-h1 font-bold text-primary tracking-tight">
              {isCompleted ? 'Hunt completed!' : 'Hunt closed'}
            </h1>
            <p className="text-body-sm text-secondary font-medium">{team.name} ({team.color} team)</p>
          </div>

          {isCompleted ? (
            <div className="space-y-4">
              <div className="p-5 bg-surface-2/80 rounded-2xl border border-border-subtle space-y-2 text-center shadow-inner">
                <p className="text-caption text-muted font-medium">Completion time</p>
                <p className="text-display font-mono font-extrabold text-accent-brand">
                  {durationText}
                </p>
                <p className="text-caption text-secondary">
                  You successfully solved all 5 clues!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-surface-2/50 rounded-xl border border-border-subtle text-center">
                  <p className="text-micro text-muted font-medium">Total penalties</p>
                  <p className="text-body font-bold text-primary mt-0.5">{team.penalty_count || 0}</p>
                </div>
                <div className="p-3.5 bg-surface-2/50 rounded-xl border border-border-subtle text-center">
                  <p className="text-micro text-muted font-medium">Final score</p>
                  <p className="text-body font-bold text-accent-brand mt-0.5">
                    {Math.max(0, 100 - (team.penalty_count || 0) * 10)} pts
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-feedback-error/10 border border-feedback-error/20 rounded-xl text-caption text-feedback-error">
              {team.close_reason || 'Game closed by organizer or time limit reached.'}
            </div>
          )}

          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => { localStorage.removeItem('treasure_hunt_team_id'); onReset(); }}
            className="touch-target text-caption font-semibold mt-2"
          >
            Start new game / Home
          </Button>
        </Card>
      </div>
    );
  }

  // ACTIVE GAMEPLAY SCREEN (clues_solved < 5)
  return (
    <div className="flex flex-col min-h-screen relative bg-surface-0">
      {/* Background radial glow - Crisp Black and Blue Theme */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full blur-[120px] pointer-events-none opacity-20 bg-accent-brand -z-10" />

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 h-[58px] flex items-center justify-between px-4 sm:px-6 bg-surface-1/90 backdrop-blur-xl border-b border-border-subtle/80 shadow-sm shadow-black/20">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-surface-2/80 hover:bg-surface-3 border border-border-subtle/80 text-secondary hover:text-primary transition-all active:scale-95 shrink-0"
            aria-label="Back to menu"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
          </button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[0.875rem] font-semibold text-primary truncate max-w-[140px] xs:max-w-[180px]">
                {team.name}
              </span>
              <span className="text-[0.6875rem] font-mono text-muted">#{team.team_code || '-----'}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {(() => {
                const colorKey = (team.color || 'blue').toLowerCase();
                const pathInfo = PATH_BADGES[colorKey] || PATH_BADGES.blue;
                return (
                  <span className={`path-badge ${pathInfo.badgeClass} px-2.5 py-0.5 rounded-full text-[0.625rem] font-semibold tracking-wide flex items-center gap-1.5 shadow-sm`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${pathInfo.dotClass}`} />
                    {team.color ? `${team.color.charAt(0).toUpperCase() + team.color.slice(1)} Path` : 'Blue Path'}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {timeLeft && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border font-mono text-[0.75rem] font-semibold shadow-sm transition-all ${timerAlert === 'critical'
                ? 'bg-feedback-error/15 border-feedback-error/40 text-feedback-error animate-pulse'
                : timerAlert === 'warning'
                  ? 'bg-feedback-warning/15 border-feedback-warning/40 text-feedback-warning'
                  : 'bg-surface-2/80 border-border-subtle text-secondary'
              }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{timeLeft}</span>
            </div>
          )}

          <button
            onClick={() => fetchGameState(true)}
            disabled={refreshing}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-surface-2/80 hover:bg-surface-3 border border-border-subtle/80 text-secondary hover:text-primary transition-all active:scale-95 disabled:opacity-50 shrink-0"
            aria-label="Sync game state"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Game Container */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-8 flex flex-col justify-center items-center relative">
        <div className="w-full max-w-[460px] sm:max-w-[480px] mx-auto">
          {/* Spacious Game Card */}
          <Card
            variant="elevated"
            padding="none"
            className="relative overflow-hidden transition-all duration-500 rounded-2xl bg-surface-1/90 backdrop-blur-xl border border-border-subtle shadow-2xl"
          >
            {/* Stepper Header */}
            <div className="px-5 py-3.5 border-b border-border-subtle/70 bg-surface-2/40 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4, 5].map((step) => {
                  const isCompleted = step <= team.clues_solved;
                  const isActive = step === team.clues_solved + 1;
                  return (
                    <React.Fragment key={step}>
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[0.75rem] font-bold border transition-all duration-300 ${isCompleted
                              ? 'bg-feedback-success/20 border-feedback-success text-feedback-success shadow-sm'
                              : isActive
                                ? 'bg-surface-0 border-accent-brand text-accent-brand font-extrabold shadow-lg ring-2 ring-offset-2 ring-offset-surface-1 ring-accent-brand/50'
                                : 'border-border-strong bg-surface-3/60 text-muted'
                            }`}
                        >
                          {isCompleted ? '✓' : step}
                        </div>
                      </div>
                      {step < 5 && (
                        <div className={`flex-1 h-0.5 mx-1.5 rounded-full transition-all duration-500 ${step <= team.clues_solved
                            ? 'bg-feedback-success/60'
                            : 'bg-border-subtle'
                          }`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Current Location Clue or Game Challenge */}
              {team.waiting_for_qr ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full animate-ping bg-accent-brand" />
                      <span className="text-[0.875rem] font-bold text-primary">Clue #{team.clues_solved + 1}</span>
                    </div>
                    <span className="text-[0.6875rem] font-medium text-muted bg-surface-2/80 px-2.5 py-0.5 rounded-full border border-border-subtle">
                      Clue {team.clues_solved + 1} of 5
                    </span>
                  </div>

                  {/* Clue Card Frame */}
                  <div className="bg-surface-2/50 border border-border-subtle/80 rounded-2xl p-5 space-y-3.5 shadow-inner">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-surface-3/80 border border-border-subtle shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4 text-accent-brand" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-[0.95rem] font-semibold text-primary leading-snug">
                          {clue ? clue.clue_text : 'Find the next location.'}
                        </h3>
                        <p className="text-[0.75rem] text-secondary leading-relaxed">
                          Find and scan the QR code for this clue.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleOpenScanner}
                    className="touch-target shadow-lg shadow-black/30 text-[0.875rem] font-semibold h-[48px]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Scan location QR</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="p-2.5 px-3.5 bg-surface-2/70 rounded-xl border border-border-subtle text-[0.75rem] font-medium flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-accent-brand" />
                      <span className="text-primary font-semibold">Clue #{team.clues_solved + 1} Unlocked</span>
                    </div>
                    <span className="text-[0.6875rem] text-muted font-mono">Clue {team.clues_solved + 1} of 5</span>
                  </div>

                  {clue ? (
                    <GameRenderer
                      teamId={team.id}
                      colorTheme={theme}
                      gameType={clue.game_type}
                      gameData={clue.game_data}
                      onSolved={() => fetchGameState(false)}
                      onIncorrect={() => fetchGameState(false)}
                    />
                  ) : (
                    <div className="p-6 bg-surface-2/60 rounded-2xl text-center space-y-3">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent-brand" />
                      <p className="text-caption text-muted">Loading challenge data...</p>
                      <Button variant="secondary" size="sm" onClick={() => fetchGameState(true)}>
                        Reload challenge
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Stats Bar */}
              <div className="pt-4 border-t border-border-subtle/80 flex justify-between text-[0.75rem] font-medium items-center">
                <span className="flex items-center gap-1.5 text-muted">
                  <Skull className="w-3.5 h-3.5 text-feedback-warning" />
                  <span>Penalties: <strong className="text-primary">{team.penalty_count}</strong></span>
                </span>
                <button
                  onClick={() => fetchGameState(true)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 text-secondary hover:text-primary py-1 px-2.5 rounded-lg bg-surface-2/60 hover:bg-surface-3/60 transition-all text-[0.75rem] font-medium"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* QR Scanner BottomSheet */}
      <BottomSheet
        isOpen={showScanner}
        onClose={handleCloseScanner}
        title={null}
        showCloseButton={false}
        size="sm"
        className="max-w-[360px] mx-auto my-auto"
      >
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-between pb-1 border-b border-border-subtle/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-surface-2 border border-border-subtle">
                <Camera className="w-4 h-4 text-accent-brand" />
              </div>
              <span className="text-[0.875rem] font-semibold text-primary">Scan location QR</span>
            </div>
            <button
              onClick={handleCloseScanner}
              className="p-1 rounded-lg text-muted hover:text-primary hover:bg-surface-2 transition-all"
              aria-label="Close scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative w-full max-w-[260px] mx-auto aspect-square bg-black rounded-2xl overflow-hidden border border-border-subtle shadow-2xl">
            {/* qr-reader div must ALWAYS be in the DOM when the scanner sheet is open,
                otherwise Html5Qrcode cannot attach the camera feed and the browser
                permission prompt will never appear. It is hidden until granted. */}
            <div
              id="qr-reader"
              className={`w-full h-full ${cameraPermission === 'granted' ? '' : 'opacity-0'}`}
            />

            {cameraPermission === 'granted' && !scannerError && !verifying && !verificationFeedback && (
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-accent-brand" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-accent-brand" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-accent-brand" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-accent-brand" />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.6875rem] text-white/80 font-medium px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md">
                  Align QR inside frame
                </div>
              </div>
            )}

            {cameraPermission === 'requesting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-0/95 p-4 text-center">
                <Loader2 className="h-7 w-7 animate-spin text-accent-brand" />
                <p className="text-caption font-semibold text-primary">Requesting camera access…</p>
                <p className="text-micro text-secondary">Tap Allow in browser prompt.</p>
              </div>
            )}

            {verifying && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-0/90 backdrop-blur-sm">
                <Loader2 className="w-7 h-7 animate-spin text-accent-brand" />
                <span className="text-caption font-semibold text-secondary">Verifying location…</span>
              </div>
            )}

            {scannerError && cameraPermission === 'denied' && !verificationFeedback && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 bg-surface-0/95 text-center">
                <AlertTriangle className="w-8 h-8 text-feedback-error" />
                <p className="text-caption font-semibold text-feedback-error">Camera blocked</p>
                <p className="text-micro text-muted">{scannerError}</p>
                <Button variant="primary" size="sm" onClick={requestCameraPermission}>Try again</Button>
              </div>
            )}

            {verificationFeedback && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 bg-surface-0/95 backdrop-blur-sm text-center">
                {verificationFeedback.success ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-feedback-success" />
                    <div>
                      <p className="text-body-sm font-semibold text-feedback-success">Location verified!</p>
                      <p className="text-micro text-secondary mt-0.5">Challenge unlocked</p>
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      fullWidth
                      onClick={handleStartChallenge}
                    >
                      Start challenge
                    </Button>
                  </>
                ) : (
                  <>
                    <XCircle className="w-10 h-10 text-feedback-error" />
                    <div>
                      <p className="text-body-sm font-semibold text-feedback-error">Wrong location</p>
                      <p className="text-micro text-muted mt-0.5">This QR doesn't match your clue.</p>
                    </div>
                    <Button variant="secondary" size="sm" fullWidth onClick={handleScanAgain}>Scan again</Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
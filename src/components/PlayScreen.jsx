import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import GameRenderer from './GameRenderer';
import { Html5Qrcode } from 'html5-qrcode';
import { Trophy, Clock, Skull, RefreshCw, Loader2, MapPin, CheckCircle, Camera, AlertTriangle, CheckCircle2, XCircle, ChevronLeft } from 'lucide-react';
import { Card, Button, BottomSheet } from '@/components/primitives';

const PATH_THEMES = {
  red: { name: 'RED', accent: 'red', badgeClass: 'path-badge-red' },
  blue: { name: 'BLUE', accent: 'blue', badgeClass: 'path-badge-blue' },
  green: { name: 'GREEN', accent: 'green', badgeClass: 'path-badge-green' },
  yellow: { name: 'YELLOW', accent: 'yellow', badgeClass: 'path-badge-yellow' },
  purple: { name: 'PURPLE', accent: 'purple', badgeClass: 'path-badge-purple' },
  orange: { name: 'ORANGE', accent: 'orange', badgeClass: 'path-badge-orange' },
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
  const [verificationFeedback, setVerificationFeedback] = useState(null);
  const html5QrCodeRef = useRef(null);
  const readerRef = useRef(null);

  const fetchGameState = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      setError('');
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle();

      if (teamError) throw teamError;

      if (!teamData) {
        localStorage.removeItem('treasure_hunt_team_id');
        onReset();
        return;
      }

      setTeam(teamData);

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

    let intervalId;
    if (team && team.clues_solved === 5 && !team.finish_time) {
      intervalId = setInterval(() => fetchGameState(false), 10000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [team, fetchGameState]);

  // QR Scanner effect using BottomSheet
  useEffect(() => {
    let html5QrCode;
    if (showScanner && !scannerSuccess && !verifying) {
      setScannerError('');
      const timer = setTimeout(async () => {
        try {
          html5QrCode = new Html5Qrcode("qr-reader");
          html5QrCodeRef.current = html5QrCode;

          const qrCodeSuccessCallback = async (decodedText) => {
            setVerifying(true);
            try {
              await html5QrCode.stop();
            } catch (err) {
              console.error("Failed to stop scanner", err);
            }

            // Valid path colors and max stages
            const VALID_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
            const MAX_STAGE = 5;

            let color = '';
            let stage = 0;
            let isValidUrl = false;
            try {
              const url = new URL(decodedText);
              // Validate origin matches our app origin to prevent cross-site QR codes
              if (url.origin === window.location.origin) {
                isValidUrl = true;
              }
              color = url.searchParams.get('color') || '';
              stage = parseInt(url.searchParams.get('stage') || '0', 10);
            } catch {
              const search = decodedText.includes('?') ? decodedText.substring(decodedText.indexOf('?')) : '?' + decodedText;
              const params = new URLSearchParams(search);
              color = params.get('color') || '';
              stage = parseInt(params.get('stage') || '0', 10);
            }

            // Validate color is a known path color
            const isValidColor = VALID_COLORS.includes(color.toLowerCase());
            // Validate stage is a positive integer within range
            const isValidStage = Number.isInteger(stage) && stage >= 1 && stage <= MAX_STAGE;

            if (!isValidUrl || !isValidColor || !isValidStage) {
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
                p_scanned_color: color,
                p_scanned_stage: stage
              });

              if (rpcError) throw rpcError;

              if (data.success) {
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
          setScannerError('Camera access denied or could not find environment camera. Please allow camera permissions.');
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
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

  const handleCloseScanner = () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().catch(() => {});
    }
    setShowScanner(false);
    setScannerSuccess(false);
    setVerificationFeedback(null);
    setScannerError('');
  };

  const handleStartChallenge = async () => {
    setShowScanner(false);
    setScannerSuccess(false);
    setVerificationFeedback(null);
    await fetchGameState();
  };

  const handleScanAgain = () => {
    setVerificationFeedback(null);
    setScannerSuccess(false);
    setScannerError('');
  };

  const handleSimulatedScan = async () => {
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
          message: 'LOCATION VERIFIED! Challenge unlocked.'
        });
      } else {
        setVerificationFeedback({
          success: false,
          message: data.error || 'WRONG QR. This is not the correct location.'
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[80vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: `hsl(var(--accent-indigo))` }} />
        <span className="text-caption text-muted">Loading game progress...</span>
      </div>
    );
  }

  if (error && !team) {
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

          <h1 className="text-h1 font-black text-primary tracking-tight leading-none mb-1">CONGRATULATIONS!</h1>
          <p className="text-caption font-semibold text-feedback-success uppercase tracking-widest mb-6">Treasure Hunt Complete</p>

          <div className="space-y-4 text-left">
            <div className="flex justify-between items-center pb-3 border-b border-border-subtle">
              <span className="text-body-sm text-secondary">Team Name</span>
              <span className="text-body-sm font-bold text-primary uppercase">{team.name}</span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-border-subtle">
              <span className="text-body-sm text-secondary">Path Color</span>
<span className={`path-badge ${theme.badgeClass} px-2 py-0.5 rounded text-micro font-bold uppercase`}>
                {theme.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-surface-2 border border-border-subtle p-4 rounded-2xl flex flex-col items-center justify-center">
                <Clock className="w-5 h-5 text-accent-indigo mb-1" />
                <span className="text-micro uppercase font-semibold text-muted">Time Taken</span>
                <span className="text-body font-extrabold text-primary mt-0.5">{getDurationText(team.start_time, team.finish_time)}</span>
              </div>

              <div className="bg-surface-2 border border-border-subtle p-4 rounded-2xl flex flex-col items-center justify-center">
                <Skull className="w-5 h-5 text-feedback-warning mb-1" />
                <span className="text-micro uppercase font-semibold text-muted">Penalties</span>
                <span className="text-body font-extrabold text-primary mt-0.5">{team.penalty_count}</span>
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
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none" style={{ backgroundColor: `hsl(var(--accent-indigo) / 0.2)` }} />

        <Card variant="elevated" className="w-full max-w-[360px] p-6 text-center space-y-6">
          <div className="inline-flex p-3 rounded-full bg-surface-1 border border-border-subtle mb-3 shadow-inner">
            <CheckCircle className="w-8 h-8 text-accent-indigo" />
          </div>
          <h1 className="text-h2 font-black text-primary">ALL DIGITAL CHALLENGES COMPLETE!</h1>

          <p className="text-body-sm text-secondary leading-relaxed">
            Your final challenge is physical and awaits you at the <strong className="text-primary">START DESK</strong>.
          </p>

          <div className="p-4 bg-surface-2 rounded-2xl border border-border-subtle text-left">
            <h4 className="text-caption font-bold uppercase tracking-wider text-muted mb-1.5">Your Instruction:</h4>
            <p className="text-caption text-muted leading-relaxed">
              Organizers will hand you a <strong className="text-accent-indigo">9-piece club logo jigsaw puzzle</strong>. Assemble it correctly, and the organizer will verify your finish to record your final score.
            </p>
          </div>

          <div className="pt-2 border-t border-border-subtle flex flex-col gap-3">
            <Button variant="accent" size="lg" fullWidth onClick={() => fetchGameState(true)} disabled={refreshing} loading={refreshing} style={{ backgroundColor: `hsl(var(--accent-indigo))` }}>
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
        style={{ backgroundColor: `hsl(var(--accent-${theme.accent}) / 0.15)` }}
      />

      {/* Sticky Header - 56px height, surface-0/80 + blur */}
      <header className="sticky top-0 z-40 h-[56px] flex items-center justify-between px-4 bg-surface-0/80 backdrop-blur-md border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" aria-label="Back to start" onClick={handleLogout}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <span className="text-micro text-muted uppercase tracking-widest font-semibold">Team: {team.name}</span>
            <span className={`path-badge ${theme.badgeClass} px-2 py-0.5 rounded text-micro font-bold uppercase`}>
              {theme.name} Path
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-caption font-semibold text-secondary uppercase tracking-wider">
            Clue {team.clues_solved + 1} / 5
          </span>
          <Button variant="ghost" size="sm" aria-label="Sync game state" onClick={() => fetchGameState(true)} disabled={refreshing} loading={refreshing}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Game Container - full viewport height minus header */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="w-full max-w-[360px] mx-auto">
          {/* Game Card with Progress Bar at top */}
          <Card variant="elevated" padding="none" className="relative overflow-hidden" style={{ '--theme-color-rgb': theme.rgb }}>
            {/* Progress Bar - 4px height, accent fill */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-surface-2" aria-hidden="true">
              <div
                className="h-full rounded-none"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: `hsl(var(--accent-${theme.accent}))`,
                  transition: 'width 300ms ease-out'
                }}
              />
            </div>

            <div className="p-6 space-y-6">
              {/* Card Header progress tracker */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-caption text-muted uppercase tracking-wider">Active Location</span>
                  <span className="text-body font-extrabold uppercase tracking-tight" style={{ color: `hsl(var(--accent-${theme.accent}))` }}>
                    {theme.name} Path
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-caption text-muted uppercase tracking-wider block">Progress</span>
                  <span className="text-body-sm font-black text-primary">
                    {team.clues_solved + 1} / 5
                  </span>
                </div>
              </div>

              {/* Current Location Clue or Game Challenge */}
              {team.waiting_for_qr ? (
                <div className="space-y-6 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Clue Card */}
                  <Card variant="panel" padding="lg" className="text-left space-y-4">
                    <div>
                      <span className="text-micro font-black tracking-widest uppercase" style={{ color: `hsl(var(--accent-${theme.accent}))` }}>
                        CLUE {team.clues_solved + 1}
                      </span>
                      <p className="text-body text-primary leading-relaxed font-semibold mt-2">
                        {clue ? clue.clue_text : 'Find the next physical location.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-caption text-muted font-semibold uppercase">
                      <MapPin className="w-4 h-4 animate-pulse" style={{ color: `hsl(var(--accent-${theme.accent}))` }} />
                      <span>Find the location described above.</span>
                    </div>
                  </Card>

                  {/* Lock card and Scanner trigger - centered Scan QR button 56px h */}
                  <Card variant="panel" padding="lg" className="text-center space-y-4" style={{ backgroundColor: `hsl(var(--surface-2) / 0.6)` }}>
                    <Button
                      variant="accent"
                      size="lg"
                      fullWidth
                      onClick={() => setShowScanner(true)}
                      className="touch-target"
                      style={{ backgroundColor: `hsl(var(--accent-${theme.accent}) / 0.95)` }}
                    >
                      <Camera className="w-5 h-5" style={{ color: `hsl(var(--text-inverse))` }} />
                      <span>SCAN QR</span>
                    </Button>

                    <p className="text-caption text-muted leading-relaxed max-w-xs mx-auto">
                      Game {team.clues_solved + 1} is locked until you scan the QR at the correct location.
                    </p>
                  </Card>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="p-3 bg-surface-2/60 rounded-xl border border-border-subtle text-caption font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" style={{ color: `hsl(var(--accent-${theme.accent}))` }} />
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

              {/* Stats Bar - Bottom of card, fixed position handled by layout */}
              <div className="pt-4 border-t border-border-subtle flex justify-between text-caption font-semibold uppercase">
                <span className="flex items-center gap-1.5 text-muted">
                  <Skull className="w-3.5 h-3.5 text-feedback-warning" />
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
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Sync</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* QR Scanner BottomSheet */}
      <BottomSheet
        isOpen={showScanner}
        onClose={handleCloseScanner}
        title="QR Code Scanner"
        size="full"
        className="max-h-[90vh] md:max-w-[500px] md:max-h-[500px] md:rounded-xl md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2"
      >
        <div className="space-y-4">
          <div className="text-center space-y-1 pb-2 border-b border-border-subtle">
            <h3 className="text-h2 text-primary flex items-center justify-center gap-2">
              <Camera className="w-6 h-6" style={{ color: `hsl(var(--accent-${theme.accent}))` }} />
              <span>QR Code Scanner</span>
            </h3>
            <p className="text-micro text-muted uppercase tracking-widest font-bold">
              Point at the physical location poster
            </p>
          </div>

          {/* Camera Viewport - Full-width, aspect-video (16:9) */}
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-border-subtle">
            {/* Camera feed */}
            {!scannerError && !verifying && !verificationFeedback && (
              <>
                <div id="qr-reader" className="w-full h-full" ref={readerRef} />
                {/* CSS-only corner brackets overlay with animated pulse */}
                <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                  <div className="absolute top-4 left-4 w-12 h-12 border-2 border-transparent border-t-[hsl(var(--accent-${theme.accent}))] border-l-[hsl(var(--accent-${theme.accent}))] animate-pulse" style={{ animationDuration: '2s' }} />
                  <div className="absolute top-4 right-4 w-12 h-12 border-2 border-transparent border-t-[hsl(var(--accent-${theme.accent}))] border-r-[hsl(var(--accent-${theme.accent}))] animate-pulse" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                  <div className="absolute bottom-4 left-4 w-12 h-12 border-2 border-transparent border-b-[hsl(var(--accent-${theme.accent}))] border-l-[hsl(var(--accent-${theme.accent}))] animate-pulse" style={{ animationDuration: '2s', animationDelay: '1s' }} />
                  <div className="absolute bottom-4 right-4 w-12 h-12 border-2 border-transparent border-b-[hsl(var(--accent-${theme.accent}))] border-r-[hsl(var(--accent-${theme.accent}))] animate-pulse" style={{ animationDuration: '2s', animationDelay: '1.5s' }} />
                </div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-caption text-secondary/60 uppercase tracking-wider font-semibold">
                  Align QR code within frame
                </div>
              </>
            )}

            {/* Verifying state */}
            {verifying && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-0/90 backdrop-blur-sm">
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: `hsl(var(--accent-indigo))` }} />
                <span className="text-caption text-secondary">Verifying scanned token...</span>
              </div>
            )}

            {/* Error initializing state */}
            {scannerError && !verificationFeedback && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-surface-0/95 backdrop-blur-sm text-center">
                <AlertTriangle className="w-12 h-12 text-feedback-error animate-bounce" />
                <div className="space-y-2 max-w-xs">
                  <h4 className="text-caption font-bold text-feedback-error uppercase tracking-wider">Scanner Locked</h4>
                  <p className="text-caption text-muted leading-relaxed">{scannerError}</p>
                </div>
                {/* Web Testing Sandbox Fallback */}
                <div className="pt-4 border-t border-border-subtle w-full max-w-xs space-y-3">
                  <span className="text-micro font-bold text-muted uppercase tracking-wider block">Development Sandbox</span>
                  <Button variant="accent" size="md" fullWidth onClick={handleSimulatedScan} style={{ backgroundColor: `hsl(var(--accent-indigo))` }}>
                    Bypass & Scan Correct QR (Simulated)
                  </Button>
                </div>
              </div>
            )}

            {/* Scan feedback (Success / Fail) */}
            {verificationFeedback && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-surface-0/95 backdrop-blur-sm text-center">
                {verificationFeedback.success ? (
                  <>
                    <div className="inline-flex p-3 rounded-full bg-feedback-success/10 border border-feedback-success/20">
                      <CheckCircle2 className="w-10 h-10 text-feedback-success" />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <h4 className="text-caption font-bold text-feedback-success uppercase tracking-wider">Location Verified</h4>
                      <p className="text-caption text-secondary font-medium">Challenge unlocked!</p>
                    </div>
                    <Button
                      variant="accent"
                      size="lg"
                      fullWidth
                      onClick={handleStartChallenge}
                      className="max-w-xs"
                      style={{ backgroundColor: `hsl(var(--accent-${theme.accent}) / 0.95)` }}
                    >
                      Start Challenge
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="inline-flex p-3 rounded-full bg-feedback-error/10 border border-feedback-error/20">
                      <XCircle className="w-10 h-10 text-feedback-error animate-pulse" />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <h4 className="text-caption font-bold text-feedback-error uppercase tracking-wider">Wrong Location</h4>
                      <p className="text-caption text-muted leading-relaxed">
                        This QR code does not match your current clue.
                      </p>
                    </div>
                    <Button variant="secondary" size="lg" fullWidth onClick={handleScanAgain} className="max-w-xs">
                      Scan Again
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Cancel Button - bottom-fixed in sheet */}
          {(!verificationFeedback || !verificationFeedback.success) && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={handleCloseScanner}
              className="mt-2 touch-target"
            >
              Cancel Scanner
            </Button>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
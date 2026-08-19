import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import StartScreen from './components/StartScreen';
import PlayScreen from './components/PlayScreen';
import AdminDashboard from './components/AdminDashboard';
import ScanScreen from './components/ScanScreen';
const SafeCrackerGame = lazy(() => import('./components/games/SafeCrackerGame'));
import { Compass, HelpCircle } from 'lucide-react';
import { Card, Button } from '@/components/primitives';

const DEMO_COLOR_THEME = { name: 'Demo', accent: 'brand' };
const DEMO_SAFE_CRACKER_DATA = {
  instructions: 'Solve the four clues, build the 4-digit code, and unlock the demo safe.',
  clues: [
    {
      type: 'math',
      question: '(9 × 2) - 14 = ?',
      answer: '4',
    },
    {
      type: 'digit_sum',
      question: '998',
      answer: '8',
    },
    {
      type: 'riddle',
      question: 'I am the number of wheels on a bicycle. What digit am I?',
      answer: '2',
    },
    {
      type: 'roman',
      question: 'VI',
      answer: '6',
    },
  ],
  completion_clue: {
    title: 'Final Clue',
    message: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
  },
};

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [teamId, setTeamId] = useState(localStorage.getItem('treasure_hunt_team_id') || '');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(window.location.pathname);
  }, []);

  const handleStartRegistered = useCallback((id) => {
    setTeamId(id);
    navigate('/play');
  }, [navigate]);

  const handleResetSession = useCallback(() => {
    setTeamId('');
    navigate('/');
  }, [navigate]);

  const isPlayRoute = currentPath === '/play';

  const renderScreen = () => {
    if (currentPath === '/admin') {
      return <AdminDashboard />;
    }

    if (currentPath === '/start') {
      return <StartScreen onRegistered={handleStartRegistered} />;
    }

    if (currentPath === '/scan') {
      return (
        <ScanScreen
          teamId={teamId}
          onVerified={() => navigate('/play')}
          onGoToStart={() => navigate('/')}
        />
      );
    }

    if (currentPath === '/play') {
      if (teamId) {
        return <PlayScreen teamId={teamId} onReset={handleResetSession} />;
      } else {
        return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
            <Card variant="elevated" className="w-full max-w-sm p-6">
              <HelpCircle className="w-12 h-12 text-accent-brand mx-auto mb-4" />
              <h2 className="text-h2 text-primary mb-2">No active session</h2>
              <p className="text-secondary text-body-sm mb-6">
                You have not registered your team yet. Please scan the starting QR code provided by the organizers to choose your color path and start.
              </p>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => navigate('/')}
                className="touch-target"
              >
                Go to home page
              </Button>
            </Card>
          </div>
        );
      }
    }

    if (currentPath === '/demo/safe-cracker') {
      return (
        <div className="max-w-lg mx-auto px-4 py-8">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="animate-spin w-8 h-8 text-accent-brand" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-caption text-muted">Loading demo...</span>
            </div>
          }>
            <SafeCrackerGame
              teamId="demo"
              colorTheme={DEMO_COLOR_THEME}
              gameData={DEMO_SAFE_CRACKER_DATA}
              isDemo={true}
              onSolved={() => window.alert('Safe unlocked!')}
              onIncorrect={() => { }}
            />
          </Suspense>
        </div>
      );
    }

    if (teamId) {
      return <PlayScreen teamId={teamId} onReset={handleResetSession} />;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[82vh] px-4 py-8 text-center relative overflow-hidden">
        {/* Subtle background glow aligning with poster colors */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-[120px] pointer-events-none opacity-20 bg-accent-brand" />
        
        <Card variant="elevated" padding="lg" className="w-full max-w-md space-y-6 relative z-10">
          <div className="flex flex-col items-center">
            <div className="inline-flex p-3 rounded-full bg-surface-2 border border-border-subtle mb-4 shadow-inner">
              <Compass className="w-7 h-7 text-accent-brand animate-pulse" />
            </div>
            <h1 className="text-display font-semibold text-primary tracking-tight">
              Krithohunt
            </h1>
            <p className="text-accent-brand text-micro font-semibold mt-1.5">
              Seek, solve, succeed!
            </p>
          </div>

          <div className="space-y-3.5 text-left pt-2">
            <h3 className="text-caption font-semibold text-secondary px-1">How to participate</h3>
            <div className="space-y-2.5">
              {[
                { step: '01', html: <>Meet organizers at the <span className="font-semibold text-primary">Start Desk</span> to assign your team color.</> },
                { step: '02', html: <>Scan the <span className="font-semibold text-accent-brand">assigned starting QR</span> to begin.</> },
                { step: '03', html: <>Enter your team name and details to register.</> },
                { step: '04', html: <>Solve all <span className="font-semibold text-primary">5 clues</span> and challenges.</> },
                { step: '05', html: <>Scan each physical QR code at locations to verify.</> },
              ].map(({ step, html }) => (
                <div key={step} className="flex gap-3 items-start bg-surface-2/40 border border-border-subtle/50 rounded-xl p-3 shadow-sm">
                  <span className="text-micro font-semibold text-accent-brand bg-accent-brand/10 border border-accent-brand/20 rounded-md px-1.5 py-0.5 mt-0.5 shrink-0">
                    {step}
                  </span>
                  <p className="text-body-sm text-secondary leading-relaxed">{html}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border-subtle flex justify-between items-center text-micro font-semibold text-muted">
            <span>Treasure hunt</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin')}
              className="text-muted hover:text-accent-brand underline underline-offset-4 font-semibold"
            >
              Organizer panel
            </Button>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary flex flex-col selection:bg-accent-brand selection:text-inverse">
      {!isPlayRoute && <header className="py-4 px-6 border-b border-border-subtle bg-surface-0/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <Compass className="w-5 h-5 text-accent-brand" />
            <span className="font-semibold text-sm bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent">
              Krithohunt
            </span>
          </div>

          {currentPath === '/admin' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-caption font-semibold text-accent-brand hover:text-accent-brand hover:brightness-110 underline underline-offset-4"
            >
              Back to game
            </Button>
          ) : (
            <div className="text-micro text-muted font-medium">
              {teamId ? 'Game active' : 'Waiting for team'}
            </div>
          )}
        </div>
      </header>}

      <main className="flex-1 relative z-10">
        {renderScreen()}
      </main>

      {!isPlayRoute && <footer className="py-6 px-6 border-t border-border-subtle bg-surface-0 text-center text-micro text-muted font-medium">
        &copy; {new Date().getFullYear()} Krithohunt
      </footer>}
    </div>
  );
}
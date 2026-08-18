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
    title: 'FINAL CLUE',
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
              <h2 className="text-h2 text-primary mb-2">No Active Session</h2>
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
                Go to Homepage
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
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <Card variant="elevated" className="w-full max-w-md p-8 space-y-6">
          <div className="inline-flex p-3 rounded-full bg-surface-1 border border-border-subtle mb-4 shadow-inner">
            <Compass className="w-8 h-8 text-accent-brand animate-pulse" />
          </div>

          <h1 className="text-display font-black text-primary tracking-tight">
            KRITHOHUNT
          </h1>
          <p className="text-accent-brand text-micro font-bold uppercase tracking-widest mt-1 mb-6">
            College Treasure Hunt
          </p>

          <Card variant="panel" padding="lg" className="text-left space-y-4">
            <h3 className="text-caption font-bold text-secondary uppercase tracking-wider">How to Play:</h3>
            <ol className="list-decimal list-inside text-body-sm text-secondary space-y-2.5 leading-relaxed">
              <li>Meet organizers at the <strong className="text-primary">Start Desk</strong> to assign your team color.</li>
              <li>Scan the <strong className="text-accent-brand">Starting QR Code</strong> for your assigned color path.</li>
              <li>Enter your unique Team Name to register.</li>
              <li>Solve the 5 campus clue locations and their corresponding digital challenges.</li>
              <li>Submit answers securely to unlock the next destination.</li>
            </ol>
          </Card>

          <div className="mt-8 pt-4 border-t border-border-subtle flex justify-center gap-4 text-micro font-semibold text-muted uppercase">
            <span>KRITHOHUNT Edition</span>
            <span aria-hidden="true">•</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin')}
              className="hover:text-secondary underline underline-offset-4"
            >
              Organizers Panel
            </Button>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary flex flex-col selection:bg-accent-brand selection:text-inverse">
      <header className="py-5 px-6 border-b border-border-subtle bg-surface-0/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <Compass className="w-5 h-5 text-accent-brand" />
            <span className="font-extrabold text-sm tracking-widest uppercase bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent">
              KRITHOHUNT
            </span>
          </div>

          {currentPath === '/admin' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-caption font-semibold text-accent-brand hover:text-accent-brand hover:brightness-110 underline underline-offset-4"
            >
              Back to Game
            </Button>
          ) : (
            <div className="text-micro text-muted font-medium uppercase tracking-wider">
              {teamId ? 'Game Active' : 'Waiting for Team'}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {renderScreen()}
      </main>

      <footer className="py-6 px-6 border-t border-border-subtle bg-surface-0 text-center text-micro text-muted font-medium">
        &copy; {new Date().getFullYear()} KRITHOHUNT
      </footer>
    </div>
  );
}
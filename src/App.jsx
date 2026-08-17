import React, { useState, useEffect } from 'react';
import StartScreen from './components/StartScreen';
import PlayScreen from './components/PlayScreen';
import AdminDashboard from './components/AdminDashboard';
import ScanScreen from './components/ScanScreen';
import { Compass, HelpCircle } from 'lucide-react';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [teamId, setTeamId] = useState(localStorage.getItem('treasure_hunt_team_id') || '');

  // Handle URL navigation updates without reloading
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(window.location.pathname);
  };

  const handleStartRegistered = (id) => {
    setTeamId(id);
    navigate('/play');
  };

  const handleResetSession = () => {
    setTeamId('');
    navigate('/');
  };

  // Simple router based on pathnames
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
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm shadow-2xl">
              <HelpCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-extrabold text-white mb-2">No Active Session</h2>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                You have not registered your team yet. Please scan the starting QR code provided by the organizers to choose your color path and start.
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-xs font-semibold text-white transition-all"
              >
                Go to Homepage
              </button>
            </div>
          </div>
        );
      }
    }

    // Default or root Path "/"
    if (teamId) {
      // If team session exists, auto redirect to play
      return <PlayScreen teamId={teamId} onReset={handleResetSession} />;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <div className="w-full max-w-md bg-slate-900/60 border border-slate-850 rounded-3xl p-8 shadow-2xl backdrop-blur-lg">
          <div className="inline-flex p-3 rounded-full bg-slate-950 border border-slate-850 mb-4">
            <Compass className="w-8 h-8 text-indigo-400 animate-pulse" />
          </div>
          
          <h1 className="text-3xl font-black text-white tracking-tight">
            KRITHOHUNT
          </h1>
          <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mt-1 mb-6">
            College Treasure Hunt
          </p>

          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-850 text-left space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">How to Play:</h3>
            <ol className="list-decimal list-inside text-xs text-slate-400 space-y-2.5 leading-relaxed">
              <li>Meet organizers at the <strong className="text-slate-200">Start Desk</strong> to assign your team color.</li>
              <li>Scan the <strong className="text-indigo-400">Starting QR Code</strong> for your assigned color path.</li>
              <li>Enter your unique Team Name to register.</li>
              <li>Solve the 5 campus clue locations and their corresponding digital challenges.</li>
              <li>Submit answers securely to unlock the next destination.</li>
            </ol>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-850 flex justify-center gap-4 text-[10px] font-semibold text-slate-500 uppercase">
            <span>KRITHOHUNT Edition</span>
            <span>•</span>
            <button 
              onClick={() => navigate('/admin')}
              className="hover:text-slate-400 underline decoration-indigo-500 underline-offset-4"
            >
              Organizers Panel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Navbar header */}
      <header className="py-5 px-6 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <Compass className="w-5 h-5 text-indigo-500" />
            <span className="font-extrabold text-sm tracking-widest uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              KRITHOHUNT
            </span>
          </div>

          {currentPath === '/admin' ? (
            <button
              onClick={() => navigate('/')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
            >
              Back to Game
            </button>
          ) : (
            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              {teamId ? 'Game Active' : 'Waiting for Team'}
            </div>
          )}
        </div>
      </header>

      {/* Main Screen Content */}
      <main className="flex-1 relative z-10">
        {renderScreen()}
      </main>

      {/* Mini footer */}
      <footer className="py-6 px-6 border-t border-slate-900 bg-slate-950 text-center text-[10px] text-slate-600 font-medium">
        &copy; {new Date().getFullYear()} KRITHOHUNT. Built for mobile-first speed.
      </footer>
    </div>
  );
}

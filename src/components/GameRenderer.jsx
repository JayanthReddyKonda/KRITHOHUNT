import React, { Suspense, lazy } from 'react';
import { Button } from '@/components/primitives';

const ConnectDotsGame = lazy(() => import('./ConnectDotsGame'));
const SudokuGame = lazy(() => import('./SudokuGame'));
const TowerOfHanoiGame = lazy(() => import('./games/TowerOfHanoiGame'));
const SafeCrackerGame = lazy(() => import('./games/SafeCrackerGame'));
const CampusGeoguessrGame = lazy(() => import('./CampusGeoguessrGame'));

const GameFallback = () => (
  <div className="flex flex-col items-center justify-center py-12 gap-3">
    <svg className="animate-spin w-8 h-8 text-accent-brand" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
    <span className="text-caption text-muted">Loading challenge...</span>
  </div>
);

export default function GameRenderer({ teamId, colorTheme, gameType, gameData, onSolved, onIncorrect }) {
  const supportedGame = ['sudoku', 'connect_dots', 'campus_geoguessr', 'geo_guess', 'tower_hanoi', 'tower_of_hanoi', 'safe_cracker'].includes(gameType);

  if (!supportedGame) {
    return (
      <div className="rounded-xl border border-feedback-error/30 bg-feedback-error/10 p-5 text-center space-y-3" role="alert">
        <h3 className="text-body font-bold text-primary">Challenge unavailable</h3>
        <p className="text-body-sm text-secondary">This challenge type is not supported by the current app. Sync your game state or contact an organiser.</p>
        <Button type="button" variant="secondary" size="md" onClick={onIncorrect}>
          Sync Game State
        </Button>
      </div>
    );
  }

  return (
    <Suspense fallback={<GameFallback />}>
      {gameType === 'sudoku' && (
        <SudokuGame teamId={teamId} colorTheme={colorTheme} gameData={gameData} onSolved={onSolved} onIncorrect={onIncorrect} />
      )}
      {gameType === 'connect_dots' && (
        <ConnectDotsGame teamId={teamId} colorTheme={colorTheme} gameData={gameData} onSolved={onSolved} onIncorrect={onIncorrect} />
      )}
      {(gameType === 'campus_geoguessr' || gameType === 'geo_guess') && (
        <CampusGeoguessrGame teamId={teamId} colorTheme={colorTheme} gameData={gameData} onSolved={onSolved} onIncorrect={onIncorrect} />
      )}
      {(gameType === 'tower_hanoi' || gameType === 'tower_of_hanoi') && (
        <TowerOfHanoiGame teamId={teamId} colorTheme={colorTheme} onSolved={onSolved} onIncorrect={onIncorrect} />
      )}
      {gameType === 'safe_cracker' && (
        <SafeCrackerGame teamId={teamId} colorTheme={colorTheme} gameData={gameData} onSolved={onSolved} onIncorrect={onIncorrect} />
      )}
    </Suspense>
  );
}
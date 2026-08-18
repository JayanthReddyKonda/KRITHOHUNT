import React, { Suspense, lazy } from 'react';

const ConnectDotsGame = lazy(() => import('./ConnectDotsGame'));
const SudokuGame = lazy(() => import('./SudokuGame'));
const TowerOfHanoiGame = lazy(() => import('./games/TowerOfHanoiGame'));
const SafeCrackerGame = lazy(() => import('./games/SafeCrackerGame'));
const CampusGeoguessrGame = lazy(() => import('./CampusGeoguessrGame'));

const GameFallback = () => (
  <div className="flex flex-col items-center justify-center py-12 gap-3">
    <svg className="animate-spin w-8 h-8 text-accent-indigo" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
    <span className="text-caption text-muted">Loading challenge...</span>
  </div>
);

export default function GameRenderer({ teamId, colorTheme, gameType, gameData, onSolved, onIncorrect }) {
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
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { GameCell, SudokuCell, KeypadButton, Card, Button } from '@/components/primitives';

export default function SudokuGame({ teamId, colorTheme, gameData, onSolved, onIncorrect }) {
  const initialPuzzle = React.useMemo(() => gameData?.puzzle || [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ], [gameData]);

  const [board, setBoard] = useState(() => {
    const saved = localStorage.getItem(`krithohunt_sudoku_${teamId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved sudoku board', e);
      }
    }
    return JSON.parse(JSON.stringify(initialPuzzle));
  });

  const [selectedCell, setSelectedCell] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    localStorage.setItem(`krithohunt_sudoku_${teamId}`, JSON.stringify(board));
  }, [board, teamId]);

  useEffect(() => {
    const saved = localStorage.getItem(`krithohunt_sudoku_${teamId}`);
    if (!saved) {
      setBoard(JSON.parse(JSON.stringify(initialPuzzle)));
    }
  }, [gameData, teamId, initialPuzzle]);

  const handleCellClick = (row, col) => {
    if (initialPuzzle[row][col] !== 0) return;
    setSelectedCell({ row, col });
    setErrorMsg('');
  };

  const handleNumberInput = (num) => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    const newBoard = [...board.map(r => [...r])];
    newBoard[row][col] = num;
    setBoard(newBoard);
    setErrorMsg('');
  };

  const handleClearCell = () => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    const newBoard = [...board.map(r => [...r])];
    newBoard[row][col] = 0;
    setBoard(newBoard);
    setErrorMsg('');
  };

  const handleResetBoard = () => {
    if (confirm('Are you sure you want to clear all your entries for this Sudoku?')) {
      setBoard(JSON.parse(JSON.stringify(initialPuzzle)));
      setSelectedCell(null);
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  const checkPuzzleSolved = async () => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] === 0) {
          setErrorMsg('Please fill all cells in the Sudoku grid before checking.');
          return;
        }
      }
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const serializedAnswer = JSON.stringify(board);

      const { data, error } = await supabase.rpc('submit_team_answer', {
        p_team_id: teamId,
        p_answer: serializedAnswer
      });

      if (error) throw error;

      if (data.success) {
        setSuccessMsg('Sudoku solved!');
        localStorage.removeItem(`krithohunt_sudoku_${teamId}`);
        setTimeout(() => {
          onSolved();
        }, 1500);
      } else {
        setErrorMsg(data.error || 'Incorrect answer. Penalty count increased (+1)!');
        onIncorrect();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const accentColor = `hsl(var(--accent-${colorTheme?.accent || 'indigo'}))`;
  const accentBorder = `hsl(var(--accent-${colorTheme?.accent || 'indigo'}) / 0.25)`;

  return (
    <div className="space-y-5">
      <Card variant="panel" padding="md" className="space-y-2">
        <h4 className="text-caption font-bold text-muted uppercase tracking-wider">
          Game 1: 4×4 Mini Sudoku
        </h4>
        <p className="text-body-sm text-secondary leading-relaxed">
          Fill the empty cells so that every row, column, and 2×2 sub-grid contains digits <strong className="text-primary">1 to 4</strong> exactly once.
        </p>
      </Card>

      <div className="flex flex-col items-center">
        <Card variant="elevated" padding="sm" className="w-full max-w-[280px]">
          <div className="grid grid-cols-4 gap-1.5 aspect-square">
            {board.map((rowArr, rIdx) =>
              rowArr.map((cellValue, cIdx) => {
                const isFixed = initialPuzzle[rIdx][cIdx] !== 0;
                const isSelected = selectedCell && selectedCell.row === rIdx && selectedCell.col === cIdx;

                return (
                  <SudokuCell
                    key={`${rIdx}-${cIdx}`}
                    value={cellValue}
                    isFixed={isFixed}
                    isSelected={isSelected}
                    onClick={() => handleCellClick(rIdx, cIdx)}
                    style={
                      isSelected && !isFixed
                        ? { borderColor: accentColor, boxShadow: `0 0 12px ${accentBorder}` }
                        : {}
                    }
                    aria-label={isFixed ? `Fixed digit ${cellValue}, row ${rIdx + 1}, column ${cIdx + 1}` : `Empty cell, row ${rIdx + 1}, column ${cIdx + 1}`}
                  />
                );
              })
            )}
          </div>
        </Card>
      </div>

      <Card variant="panel" padding="md" className="space-y-4 max-w-[280px] w-full mx-auto">
        <div className="flex justify-between items-center text-micro font-bold text-muted px-1">
          <span>{selectedCell ? 'Tap digit to insert' : 'Select a grid cell'}</span>
          <Button variant="ghost" size="sm" onClick={handleResetBoard} aria-label="Reset grid">
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Grid</span>
          </Button>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4].map((num) => (
            <KeypadButton
              key={num}
              value={num}
              onClick={() => handleNumberInput(num)}
              disabled={!selectedCell}
              active={selectedCell}
              style={selectedCell ? { borderColor: accentBorder } : {}}
              aria-label={selectedCell ? `Enter digit ${num}` : 'Select a cell first'}
            />
          ))}

          <GameCell
            variant={selectedCell ? 'default' : 'fixed'}
            onClick={handleClearCell}
            disabled={!selectedCell}
            className="text-caption font-bold"
            style={selectedCell ? { borderColor: `hsl(var(--accent-${colorTheme?.accent || 'indigo'}) / 0.25)` } : {}}
            aria-label={selectedCell ? 'Clear selected cell' : 'Select a cell first'}
          >
            Clear
          </GameCell>
        </div>
      </Card>

      <div className="space-y-3 max-w-[280px] w-full mx-auto">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-feedback-error/10 border border-feedback-error/20 text-feedback-error text-body-sm flex gap-2.5 items-start animate-shake" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-bold">Check Failed: </span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-feedback-success/10 border border-feedback-success/20 text-feedback-success text-body-sm flex gap-2.5 items-start" role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-bold">Success: </span>
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        <Button
          variant="accent"
          size="lg"
          fullWidth
          onClick={checkPuzzleSolved}
          disabled={loading || !!successMsg}
          loading={loading}
          style={!successMsg ? { backgroundColor: accentColor } : {}}
        >
          Check Puzzle
        </Button>
      </div>
    </div>
  );
}
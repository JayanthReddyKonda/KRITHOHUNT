import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, Loader2, Lock, RotateCcw } from 'lucide-react';

export default function SudokuGame({ teamId, colorTheme, gameData, onSolved, onIncorrect }) {
  const initialPuzzle = React.useMemo(() => gameData?.puzzle || [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ], [gameData]);

  // We store the current board grid. User edits are stored here.
  const [board, setBoard] = useState(() => {
    const saved = localStorage.getItem(`krithohunt_sudoku_${teamId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved sudoku board', e);
      }
    }
    return JSON.parse(JSON.stringify(initialPuzzle)); // Deep clone
  });

  const [selectedCell, setSelectedCell] = useState(null); // { row, col }
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Persist board inputs in localStorage
  useEffect(() => {
    localStorage.setItem(`krithohunt_sudoku_${teamId}`, JSON.stringify(board));
  }, [board, teamId]);

  // If gameData changes, reset board if appropriate
  useEffect(() => {
    // Check if the current board is empty or matches initial
    const saved = localStorage.getItem(`krithohunt_sudoku_${teamId}`);
    if (!saved) {
      setBoard(JSON.parse(JSON.stringify(initialPuzzle)));
    }
  }, [gameData, teamId, initialPuzzle]);

  const handleCellClick = (row, col) => {
    // Cannot select initial fixed cells
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
    // 1. Validate that all cells are filled
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
      // Serialize completed board (JSON string without spaces)
      const serializedAnswer = JSON.stringify(board);

      // Submit to database RPC
      const { data, error } = await supabase.rpc('submit_team_answer', {
        p_team_id: teamId,
        p_answer: serializedAnswer
      });

      if (error) throw error;

      if (data.success) {
        setSuccessMsg('🎉 Sudoku solved!');
        // Clear saved draft board from localStorage
        localStorage.removeItem(`krithohunt_sudoku_${teamId}`);
        // Notify parent that the clue has been solved
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

  return (
    <div className="space-y-6">
      {/* Game Header Instructions */}
      <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 text-left space-y-1">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Game 1: 4×4 Mini Sudoku
        </h4>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Fill the empty cells so that every row, column, and 2×2 sub-grid contains digits <strong className="text-slate-200">1 to 4</strong> exactly once.
        </p>
      </div>

      {/* Sudoku Board Grid Container */}
      <div className="flex flex-col items-center">
        <div className="bg-slate-950/45 p-3 rounded-3xl border border-slate-850 shadow-inner w-full max-w-[280px]">
          <div className="grid grid-cols-4 gap-1.5 aspect-square">
            {board.map((rowArr, rIdx) =>
              rowArr.map((cellValue, cIdx) => {
                const isFixed = initialPuzzle[rIdx][cIdx] !== 0;
                const isSelected = selectedCell && selectedCell.row === rIdx && selectedCell.col === cIdx;
                
                // Sub-grid border separation styles
                const borderRightClass = cIdx === 1 ? 'border-r-2 border-slate-800' : '';
                const borderBottomClass = rIdx === 1 ? 'border-b-2 border-slate-800' : '';

                // Active style configuration
                let cellStyle = 'bg-slate-900/60 border border-slate-850 text-white';
                if (isFixed) {
                  cellStyle = 'bg-slate-900 border-2 border-slate-800/80 text-slate-400 font-extrabold cursor-not-allowed';
                } else if (isSelected) {
                  cellStyle = `bg-slate-950 border-2 ring-2 text-white font-bold transform scale-105 transition-all`;
                } else if (cellValue !== 0) {
                  cellStyle = 'bg-slate-900/90 border border-slate-750 text-indigo-400 font-bold';
                }

                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    onClick={() => handleCellClick(rIdx, cIdx)}
                    disabled={isFixed}
                    style={
                      isSelected && !isFixed
                        ? { 
                            borderColor: `rgba(${colorTheme.rgb}, 0.8)`,
                            boxShadow: `0 0 12px rgba(${colorTheme.rgb}, 0.25)` 
                          }
                        : {}
                    }
                    className={`
                      relative flex items-center justify-center rounded-xl text-base transition-all select-none focus:outline-none aspect-square
                      ${cellStyle} ${borderRightClass} ${borderBottomClass}
                    `}
                  >
                    {cellValue !== 0 ? cellValue : ''}
                    {isFixed && (
                      <Lock className="absolute top-1 right-1 w-2.5 h-2.5 text-slate-600 opacity-60" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Touch Pad Input Controls */}
      <div className="space-y-4">
        {/* Cell selection cue / Number Keypad */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[280px] bg-slate-950/60 border border-slate-850/80 p-3 rounded-2xl flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 px-1">
              <span>{selectedCell ? 'Tap digit to insert' : 'Select a grid cell'}</span>
              <button 
                onClick={handleResetBoard}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Grid</span>
              </button>
            </div>

            {/* Keypad Digits & Clear */}
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  disabled={!selectedCell}
                  onClick={() => handleNumberInput(num)}
                  style={selectedCell ? { borderColor: `rgba(${colorTheme.rgb}, 0.15)` } : {}}
                  className={`
                    py-2 rounded-xl border font-bold text-sm transition-all focus:outline-none active:scale-95
                    ${selectedCell 
                      ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850 hover:text-white' 
                      : 'bg-slate-950/40 border-slate-950 text-slate-600 cursor-not-allowed'
                    }
                  `}
                >
                  {num}
                </button>
              ))}

              <button
                disabled={!selectedCell}
                onClick={handleClearCell}
                className={`
                  py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none active:scale-95
                  ${selectedCell 
                    ? 'bg-slate-900 border-red-950/50 text-red-400 hover:bg-red-950/20' 
                    : 'bg-slate-950/40 border-slate-950 text-slate-600 cursor-not-allowed'
                  }
                `}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Action Button & Messages */}
        <div className="space-y-3">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2.5 items-start animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Check Failed: </span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Success: </span>
                <span>{successMsg}</span>
              </div>
            </div>
          )}

          <button
            onClick={checkPuzzleSolved}
            disabled={loading || !!successMsg}
            style={!successMsg ? { backgroundColor: `rgba(${colorTheme.rgb}, 0.9)` } : {}}
            className={`
              w-full py-4 rounded-2xl text-slate-950 font-bold text-xs tracking-wider uppercase shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
              ${successMsg ? 'bg-emerald-500 text-slate-950' : 'hover:brightness-110'}
            `}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>Check Puzzle</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

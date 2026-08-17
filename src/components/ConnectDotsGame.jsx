import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';

export default function ConnectDotsGame({ teamId, colorTheme, gameData, onSolved, onIncorrect }) {
  // Dot fixed positions (e.g. [[row, col, color_id], ...])
  // Colors: 1 = Red, 2 = Blue, 3 = Green, 4 = Yellow
  const initialDots = gameData?.dots || [
    [0, 0, 1], [2, 0, 1], // Red
    [0, 3, 2], [2, 3, 2], // Blue
    [3, 0, 3], [3, 2, 3], // Green
    [1, 1, 4], [1, 2, 4]  // Yellow
  ];

  // Map of color IDs to tailwind class names
  const COLOR_MAP = {
    0: { name: 'Empty', bg: 'bg-slate-900/60', text: 'text-slate-500', fill: 'bg-transparent', border: 'border-slate-800' },
    1: { name: 'Red', bg: 'bg-red-500/10', text: 'text-red-400', fill: 'bg-red-500', border: 'border-red-500/30' },
    2: { name: 'Blue', bg: 'bg-blue-500/10', text: 'text-blue-400', fill: 'bg-blue-500', border: 'border-blue-500/30' },
    3: { name: 'Green', bg: 'bg-emerald-500/10', text: 'text-emerald-400', fill: 'bg-emerald-500', border: 'border-emerald-500/30' },
    4: { name: 'Yellow', bg: 'bg-amber-500/10', text: 'text-amber-400', fill: 'bg-amber-500', border: 'border-amber-500/30' }
  };

  // Initialize the board grid (4x4)
  const initialBoard = () => {
    const grid = Array(4).fill(0).map(() => Array(4).fill(0));
    initialDots.forEach(([r, c, colId]) => {
      grid[r][c] = colId;
    });
    return grid;
  };

  const [board, setBoard] = useState(() => {
    const saved = localStorage.getItem(`krithohunt_connectdots_${teamId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialBoard();
  });

  const [selectedColor, setSelectedColor] = useState(1); // Default Red
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Persist board state in localStorage
  useEffect(() => {
    localStorage.setItem(`krithohunt_connectdots_${teamId}`, JSON.stringify(board));
  }, [board, teamId]);

  // Check if a cell is one of the initial fixed dots
  const isDotCell = (r, c) => {
    return initialDots.some(([dr, dc]) => dr === r && dc === c);
  };

  const handleCellClick = (r, c) => {
    if (isDotCell(r, c)) {
      // Tapping a fixed dot selects its color!
      const dot = initialDots.find(([dr, dc]) => dr === r && dc === c);
      if (dot) setSelectedColor(dot[2]);
      return;
    }

    // Toggle color in empty cells
    const newBoard = [...board.map(row => [...row])];
    if (newBoard[r][c] === selectedColor) {
      newBoard[r][c] = 0; // Clear if tapped again with same color
    } else {
      newBoard[r][c] = selectedColor; // Apply selected color
    }
    setBoard(newBoard);
    setErrorMsg('');
  };

  const handleResetBoard = () => {
    if (confirm('Are you sure you want to clear all your paths?')) {
      setBoard(initialBoard());
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  const checkPuzzleSolved = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Serialize completed board
      const serializedAnswer = JSON.stringify(board);

      // Call database RPC
      const { data, error } = await supabase.rpc('submit_team_answer', {
        p_team_id: teamId,
        p_answer: serializedAnswer
      });

      if (error) throw error;

      if (data.success) {
        setSuccessMsg('🎉 Connect the Dots solved!');
        localStorage.removeItem(`krithohunt_connectdots_${teamId}`);
        setTimeout(() => {
          onSolved();
        }, 1500);
      } else {
        setErrorMsg(data.error || 'Incorrect connections. Penalty count increased (+1)!');
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
      {/* Description */}
      <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 text-left space-y-1">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Game 2: Connect the Dots
        </h4>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Tap matching colored dots to select a path color, then tap empty cells orthogonally to draw lines. Paths cannot cross or overlap!
        </p>
      </div>

      {/* The 4x4 Drawing Board */}
      <div className="flex flex-col items-center">
        <div className="bg-slate-950/45 p-3 rounded-3xl border border-slate-850 shadow-inner w-full max-w-[280px]">
          <div className="grid grid-cols-4 gap-1.5 aspect-square">
            {board.map((rowArr, rIdx) =>
              rowArr.map((cellValue, cIdx) => {
                const isDot = isDotCell(rIdx, cIdx);
                const theme = COLOR_MAP[cellValue];

                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    onClick={() => handleCellClick(rIdx, cIdx)}
                    className={`
                      relative flex items-center justify-center rounded-xl transition-all select-none focus:outline-none aspect-square border
                      ${theme.bg} ${theme.border}
                    `}
                  >
                    {isDot ? (
                      // Render a nice dot circle
                      <span className={`w-5 h-5 rounded-full ${theme.fill} shadow-lg ring-4 ring-slate-950 animate-pulse`} />
                    ) : cellValue !== 0 ? (
                      // Render a smaller colored line track
                      <span className={`w-3.5 h-3.5 rounded-md ${theme.fill} opacity-80`} />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Palette Selector */}
      <div className="space-y-4">
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[280px] bg-slate-950/60 border border-slate-850/80 p-3 rounded-2xl flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 px-1">
              <span>Selected Drawing Color</span>
              <button 
                onClick={handleResetBoard}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Grid</span>
              </button>
            </div>

            {/* Colors picker */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((colorId) => {
                const cTheme = COLOR_MAP[colorId];
                const isSelected = selectedColor === colorId;
                return (
                  <button
                    key={colorId}
                    onClick={() => setSelectedColor(colorId)}
                    className={`
                      py-2 rounded-xl border text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-1
                      ${isSelected 
                        ? 'bg-slate-900 border-slate-700 text-white shadow-lg ring-2 ring-indigo-500/20' 
                        : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:bg-slate-900/60'
                      }
                    `}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${cTheme.fill}`} />
                    <span>{cTheme.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Button & Feedback */}
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
              w-full py-4 rounded-2xl text-slate-950 font-bold text-xs tracking-wider uppercase shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50
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

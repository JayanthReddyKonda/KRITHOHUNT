import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/primitives';

export default function SudokuGame({ teamId, colorTheme, gameData, onSolved, onIncorrect }) {
  const initialPuzzle = React.useMemo(() => gameData?.puzzle || [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ], [gameData]);
  const storageKey = `krithohunt_sudoku_${teamId}_${JSON.stringify(initialPuzzle)}`;

  const [board, setBoard] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return JSON.parse(JSON.stringify(initialPuzzle));
  });

  const [selectedCell, setSelectedCell] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const submittingRef = React.useRef(false);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(board));
  }, [board, storageKey]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    try {
      setBoard(saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(initialPuzzle)));
    } catch {
      setBoard(JSON.parse(JSON.stringify(initialPuzzle)));
    }
    setSelectedCell(null);
  }, [gameData, storageKey, initialPuzzle]);

  const handleCellClick = (row, col) => {
    if (initialPuzzle[row][col] !== 0) return;
    setSelectedCell(sel => sel?.row === row && sel?.col === col ? null : { row, col });
    setErrorMsg('');
  };

  const handleNumberInput = (num) => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = num;
    setBoard(newBoard);
    setErrorMsg('');
  };

  const handleClearCell = () => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = 0;
    setBoard(newBoard);
    setErrorMsg('');
  };

  const handleResetBoard = () => {
    if (confirm('Clear all your entries?')) {
      setBoard(JSON.parse(JSON.stringify(initialPuzzle)));
      setSelectedCell(null);
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  const checkPuzzleSolved = async () => {
    if (submittingRef.current || loading || successMsg) return;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] === 0) {
          setErrorMsg('Fill all cells before checking.');
          return;
        }
      }
    }

    submittingRef.current = true;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { data, error } = await supabase.rpc('submit_team_answer', {
        p_team_id: teamId,
        p_answer: JSON.stringify(board)
      });

      if (error) throw error;

      if (data.success) {
        setSuccessMsg('Sudoku solved!');
        localStorage.removeItem(storageKey);
        setTimeout(() => { onSolved(); }, 1500);
      } else {
        setErrorMsg(data.error || 'Incorrect — check your entries. Penalty +1.');
        onIncorrect();
        submittingRef.current = false;
      }
    } catch (err) {
      setErrorMsg(err.message || 'Connection error. Try again.');
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const accentVar = colorTheme?.accent || 'brand';

  // Cell border logic for Sudoku 2×2 box separators
  // In a 4×4 grid with 2×2 boxes: rows 0-1 are box-top, rows 2-3 are box-bottom
  // Similarly cols 0-1 left box, cols 2-3 right box
  const getCellBorderStyle = (r, c) => {
    const BOX_COLOR = 'hsl(210 25% 40%)';   // strong box border
    const CELL_COLOR = 'hsl(222 14% 18%)';  // fine cell border

    return {
      borderTop:    r === 0 ? `2px solid ${BOX_COLOR}` : r === 2 ? `2px solid ${BOX_COLOR}` : `1px solid ${CELL_COLOR}`,
      borderLeft:   c === 0 ? `2px solid ${BOX_COLOR}` : c === 2 ? `2px solid ${BOX_COLOR}` : `1px solid ${CELL_COLOR}`,
      borderBottom: r === 3 ? `2px solid ${BOX_COLOR}` : `none`,
      borderRight:  c === 3 ? `2px solid ${BOX_COLOR}` : `none`,
    };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-brand">Puzzle 1</p>
        <h4 className="text-[1.05rem] font-semibold text-primary">4×4 Mini Sudoku</h4>
        <p className="text-[0.8125rem] text-secondary">Fill so every row, column, and 2×2 box contains 1–4 exactly once.</p>
      </div>

      {/* Sudoku Board */}
      <div className="flex justify-center">
        <div
          style={{
            width: 'min(calc(100vw - 48px), 300px)',
            aspectRatio: '1',
            background: 'hsl(222 20% 9.5%)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(4, 1fr)',
              width: '100%',
              height: '100%',
            }}
          >
            {board.map((rowArr, rIdx) =>
              rowArr.map((cellValue, cIdx) => {
                const isFixed = initialPuzzle[rIdx][cIdx] !== 0;
                const isSelected = selectedCell?.row === rIdx && selectedCell?.col === cIdx;
                const isSameRow = selectedCell && selectedCell.row === rIdx && !isSelected;
                const isSameCol = selectedCell && selectedCell.col === cIdx && !isSelected;
                const isSameBox = selectedCell &&
                  Math.floor(selectedCell.row / 2) === Math.floor(rIdx / 2) &&
                  Math.floor(selectedCell.col / 2) === Math.floor(cIdx / 2) &&
                  !isSelected;

                let bg = 'hsl(222 20% 9.5%)';
                let color = 'hsl(210 25% 97%)';
                let fontWeight = '400';

                if (isFixed) {
                  bg = 'hsl(222 18% 13%)';
                  color = 'hsl(210 25% 97%)';
                  fontWeight = '600';
                } else if (isSelected) {
                  bg = `hsl(var(--accent-${accentVar}) / 0.2)`;
                  color = `hsl(var(--accent-${accentVar}))`;
                  fontWeight = '600';
                } else if (isSameRow || isSameCol || isSameBox) {
                  bg = 'hsl(222 18% 12%)';
                } else if (cellValue !== 0) {
                  color = `hsl(var(--accent-${accentVar}))`;
                  fontWeight = '500';
                }

                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    type="button"
                    onClick={() => handleCellClick(rIdx, cIdx)}
                    disabled={isFixed}
                    aria-label={`Row ${rIdx + 1}, col ${cIdx + 1}${isFixed ? ' (fixed)' : ''}: ${cellValue || 'empty'}`}
                    style={{
                      ...getCellBorderStyle(rIdx, cIdx),
                      background: bg,
                      color,
                      fontWeight,
                      fontSize: 'clamp(1.1rem, 5vw, 1.5rem)',
                      fontFamily: 'Inter, sans-serif',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isFixed ? 'default' : 'pointer',
                      transition: 'background 0.12s ease',
                      outline: 'none',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {cellValue !== 0 ? cellValue : ''}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Number Pad */}
      <div className="flex justify-center">
        <div style={{ width: 'min(calc(100vw - 48px), 300px)' }}>
          <div className="flex gap-2 mb-1.5">
            <p className="text-[11px] text-muted uppercase tracking-wide flex-1">
              {selectedCell ? 'Tap a number' : 'Select a cell first'}
            </p>
            <button
              type="button"
              onClick={handleResetBoard}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-secondary transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumberInput(num)}
                disabled={!selectedCell}
                aria-label={`Enter ${num}`}
                style={{
                  flex: 1,
                  aspectRatio: '1',
                  maxHeight: '56px',
                  background: !selectedCell ? 'hsl(222 18% 10%)' : 'hsl(222 18% 13%)',
                  border: !selectedCell
                    ? '1px solid hsl(222 14% 15%)'
                    : `1px solid hsl(var(--accent-${accentVar}) / 0.3)`,
                  borderRadius: '8px',
                  color: !selectedCell ? 'hsl(210 10% 40%)' : `hsl(var(--accent-${accentVar}))`,
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  fontFamily: 'Inter, sans-serif',
                  cursor: !selectedCell ? 'not-allowed' : 'pointer',
                  transition: 'all 0.12s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClearCell}
              disabled={!selectedCell}
              aria-label="Clear cell"
              style={{
                flex: 1,
                aspectRatio: '1',
                maxHeight: '56px',
                background: 'hsl(222 18% 10%)',
                border: '1px solid hsl(222 14% 15%)',
                borderRadius: '8px',
                color: !selectedCell ? 'hsl(210 10% 30%)' : 'hsl(210 10% 60%)',
                fontSize: '0.7rem',
                fontWeight: '500',
                fontFamily: 'Inter, sans-serif',
                cursor: !selectedCell ? 'not-allowed' : 'pointer',
                transition: 'all 0.12s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              DEL
            </button>
          </div>
        </div>
      </div>

      {/* Feedback + Submit */}
      <div className="flex justify-center">
        <div style={{ width: 'min(calc(100vw - 48px), 300px)' }} className="space-y-2.5">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-feedback-error/10 border border-feedback-error/20 text-feedback-error text-[0.8125rem] animate-shake" role="alert">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-feedback-success/15 border border-feedback-success/25 text-feedback-success text-[0.8125rem]" role="status">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={checkPuzzleSolved}
            disabled={loading || !!successMsg}
            loading={loading}
          >
            Check puzzle
          </Button>
        </div>
      </div>
    </div>
  );
}
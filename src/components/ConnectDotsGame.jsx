import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';

export default function ConnectDotsGame({ teamId, colorTheme, gameData, onSolved, onIncorrect }) {
  const rows = gameData?.rows || 7;
  const cols = gameData?.cols || 7;

  // Endpoint dots from DB or fallback
  // Format: [[row, col, colorId], ...]
  // Colors: 1 = Red, 2 = Blue, 3 = Green, 4 = Yellow
  const initialDots = gameData?.dots || [
    [0, 1, 1], [4, 5, 1], // Red
    [1, 5, 2], [5, 1, 2], // Blue
    [2, 0, 3], [4, 2, 3], // Green
    [3, 5, 4], [6, 2, 4]  // Yellow
  ];

  const storageKey = `krithohunt_connectdots_paths_${teamId}_${rows}x${cols}`;

  // Map of color IDs to visual theme styles
  const COLOR_MAP = {
    0: { name: 'Empty', stroke: '#334155', fill: 'bg-transparent', bg: 'bg-slate-900/60', border: 'border-slate-800/80', dotBg: 'bg-slate-700' },
    1: { name: 'Red', stroke: '#ef4444', fill: 'bg-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', dotBg: 'bg-red-500' },
    2: { name: 'Blue', stroke: '#3b82f6', fill: 'bg-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', dotBg: 'bg-blue-500' },
    3: { name: 'Green', stroke: '#10b981', fill: 'bg-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dotBg: 'bg-emerald-500' },
    4: { name: 'Yellow', stroke: '#f59e0b', fill: 'bg-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dotBg: 'bg-amber-500' }
  };

  // Paths state: { 1: [[r,c]...], 2: [...], 3: [...], 4: [...] }
  const [paths, setPaths] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return {
            1: Array.isArray(parsed[1]) ? parsed[1] : [],
            2: Array.isArray(parsed[2]) ? parsed[2] : [],
            3: Array.isArray(parsed[3]) ? parsed[3] : [],
            4: Array.isArray(parsed[4]) ? parsed[4] : []
          };
        }
      } catch (e) {
        console.error("Failed to load saved paths:", e);
      }
    }
    return { 1: [], 2: [], 3: [], 4: [] };
  });

  const [selectedColor, setSelectedColor] = useState(1);
  const [drawingColor, setDrawingColor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const gridRef = useRef(null);

  // Save paths to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(paths));
  }, [paths, storageKey]);

  // Helper to find dot at cell (r, c)
  const getDotAtCell = (r, c) => {
    return initialDots.find(([dr, dc]) => dr === r && dc === c);
  };

  // Helper to check if cell (r, c) belongs to another color's path
  const isCellOccupiedByOtherPath = (r, c, colorId) => {
    return Object.entries(paths).some(([cid, path]) => {
      if (parseInt(cid, 10) === colorId) return false;
      return path.some(([pr, pc]) => pr === r && pc === c);
    });
  };

  // Helper to check if a color's pair is correctly connected
  const isColorConnected = (cid) => {
    return isColorPathValid(cid, paths, initialDots, rows, cols).valid;
  };

  // POINTER EVENT HANDLERS (Sliding / Touch / Mouse Drag)
  const handlePointerDown = (e, r, c) => {
    setErrorMsg('');
    const dot = getDotAtCell(r, c);

    let activeColor = selectedColor;
    if (dot) {
      activeColor = dot[2];
      setSelectedColor(activeColor);
      setDrawingColor(activeColor);
      setPaths(prev => ({
        ...prev,
        [activeColor]: [[r, c]]
      }));
    } else {
      // If user taps on an existing cell of a path, set drawing for that color
      const existingColorId = Object.keys(paths).find(cid =>
        paths[cid].some(([pr, pc]) => pr === r && pc === c)
      );

      if (existingColorId) {
        activeColor = parseInt(existingColorId, 10);
        setSelectedColor(activeColor);
        setDrawingColor(activeColor);
        const cellIdx = paths[activeColor].findIndex(([pr, pc]) => pr === r && pc === c);
        setPaths(prev => ({
          ...prev,
          [activeColor]: paths[activeColor].slice(0, cellIdx + 1)
        }));
      } else {
        // Tap on empty cell: start path for selected color if adjacent to last point
        setDrawingColor(selectedColor);
        const currentPath = paths[selectedColor] || [];
        if (currentPath.length === 0) {
          // Check if selected color has an endpoint to start from
          const startDot = initialDots.find(([, , cid]) => cid === selectedColor);
          if (startDot) {
            setPaths(prev => ({
              ...prev,
              [selectedColor]: [[startDot[0], startDot[1]]]
            }));
          }
        }
      }
    }

    try {
      if (e.target?.setPointerCapture && e.pointerId) {
        e.target.setPointerCapture(e.pointerId);
      }
    } catch {
      // Ignore pointer capture errors
    }
  };

  const handlePointerMove = (e) => {
    if (drawingColor === null || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellW = rect.width / cols;
    const cellH = rect.height / rows;

    const c = Math.floor(x / cellW);
    const r = Math.floor(y / cellH);

    if (r < 0 || r >= rows || c < 0 || c >= cols) return;

    const currentPath = paths[drawingColor] || [];
    if (currentPath.length === 0) return;

    const lastCell = currentPath[currentPath.length - 1];
    if (r === lastCell[0] && c === lastCell[1]) return;

    // Must be orthogonally adjacent (distance 1)
    const isAdjacent = Math.abs(r - lastCell[0]) + Math.abs(c - lastCell[1]) === 1;
    if (!isAdjacent) return;

    // Backtracking support: sliding back to previous cell removes last step
    if (currentPath.length > 1) {
      const secondLastCell = currentPath[currentPath.length - 2];
      if (r === secondLastCell[0] && c === secondLastCell[1]) {
        setPaths(prev => ({
          ...prev,
          [drawingColor]: currentPath.slice(0, -1)
        }));
        return;
      }
    }

    // Do not pass through other colors' endpoints
    const dot = getDotAtCell(r, c);
    if (dot && dot[2] !== drawingColor) return;

    // Do not overlap other colors' paths
    if (isCellOccupiedByOtherPath(r, c, drawingColor)) return;

    // If sliding back into own path, prune to that index
    const selfIdx = currentPath.findIndex(([pr, pc]) => pr === r && pc === c);
    if (selfIdx !== -1) {
      setPaths(prev => ({
        ...prev,
        [drawingColor]: currentPath.slice(0, selfIdx + 1)
      }));
      return;
    }

    // Connect to matching endpoint dot and complete line!
    if (dot && dot[2] === drawingColor) {
      setPaths(prev => ({
        ...prev,
        [drawingColor]: [...currentPath, [r, c]]
      }));
      setDrawingColor(null);
      return;
    }

    // Extend path
    setPaths(prev => ({
      ...prev,
      [drawingColor]: [...currentPath, [r, c]]
    }));
  };

  const handlePointerUp = (e) => {
    setDrawingColor(null);
    try {
      if (e.target?.hasPointerCapture && e.pointerId && e.target.hasPointerCapture(e.pointerId)) {
        e.target.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore pointer release errors
    }
  };

  const handleResetBoard = () => {
    if (confirm('Are you sure you want to clear all your paths?')) {
      setPaths({ 1: [], 2: [], 3: [], 4: [] });
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  const handleResetColor = (cid) => {
    setPaths(prev => ({ ...prev, [cid]: [] }));
    setErrorMsg('');
    setSuccessMsg('');
  };

  const checkPuzzleSolved = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Pre-validate locally
    const localVal = validateConnectDots(paths, initialDots, rows, cols);
    if (!localVal.valid) {
      setErrorMsg(localVal.reason);
      setLoading(false);
      return;
    }

    try {
      // Try submit_connect_dots RPC first (which internally calls submit_team_answer)
      const { data, error } = await supabase.rpc('submit_connect_dots', {
        p_team_id: teamId,
        p_paths: paths
      });

      if (error) {
        // Network error - retry the same RPC once
        console.warn('submit_connect_dots RPC failed, retrying:', error);
        const { data: retryData, error: retryError } = await supabase.rpc('submit_connect_dots', {
          p_team_id: teamId,
          p_paths: paths
        });
        if (retryError) throw retryError;
        if (retryData?.success) {
          setSuccessMsg('🎉 Connect the Dots solved!');
          localStorage.removeItem(storageKey);
          setTimeout(() => onSolved(), 1500);
        } else {
          setErrorMsg(retryData?.error || 'Incorrect connections. Penalty count increased (+1)!');
          onIncorrect();
        }
        return;
      }

      if (data?.success) {
        setSuccessMsg('🎉 Connect the Dots solved!');
        localStorage.removeItem(storageKey);
        setTimeout(() => onSolved(), 1500);
      } else {
        setErrorMsg(data?.error || 'Incorrect connections. Penalty count increased (+1)!');
        onIncorrect();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const buttonBgStyle = !successMsg
    ? colorTheme?.rgb
      ? { backgroundColor: `rgba(${colorTheme.rgb}, 0.9)` }
      : { backgroundColor: `hsl(var(--accent-${colorTheme?.accent || 'brand'}))` }
    : {};

  return (
    <div className="space-y-5 select-none">
      {/* Description Header */}
      <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 text-left space-y-1">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Game 2: Connect the Dots ({cols}x{rows})
          </h4>
          <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">
            Slide to draw
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Touch and drag from a colored dot across adjacent cells to draw a path to its matching endpoint. Paths cannot cross!
        </p>
      </div>

      {/* Grid Container with Overlay SVG lines */}
      <div className="flex flex-col items-center">
        <div
          ref={gridRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
          style={{ touchAction: 'none' }}
          className="relative w-full max-w-[320px] aspect-square p-2 bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden"
        >
          {/* SVG Line Overlay */}
          <svg
            className="pointer-events-none absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] z-10"
            viewBox={`0 0 ${cols * 100} ${rows * 100}`}
          >
            {Object.entries(paths).map(([cid, path]) => {
              if (!path || path.length < 1) return null;
              const colorId = parseInt(cid, 10);
              const colorStyle = COLOR_MAP[colorId] || COLOR_MAP[1];

              const pathString = path.map((cell, idx) => {
                const x = cell[1] * 100 + 50;
                const y = cell[0] * 100 + 50;
                return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
              }).join(' ');

              return (
                <g key={cid}>
                  {/* Outer glow line */}
                  <path
                    d={pathString}
                    stroke={colorStyle.stroke}
                    strokeWidth={28}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={0.3}
                  />
                  {/* Solid core line */}
                  <path
                    d={pathString}
                    stroke={colorStyle.stroke}
                    strokeWidth={18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={0.95}
                  />
                </g>
              );
            })}
          </svg>

          {/* Grid Cells Matrix */}
          <div
            className="grid h-full w-full gap-1 relative z-20"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
            }}
          >
            {Array(rows).fill(null).map((_, r) =>
              Array(cols).fill(null).map((_, c) => {
                const dot = getDotAtCell(r, c);
                const isDot = !!dot;
                const colorId = isDot ? dot[2] : 0;
                const dotStyle = COLOR_MAP[colorId];

                // Check if cell is part of any drawn path
                const pathColorId = Object.keys(paths).find(cid =>
                  paths[cid].some(([pr, pc]) => pr === r && pc === c)
                );
                const cellPathStyle = pathColorId ? COLOR_MAP[pathColorId] : null;

                return (
                  <div
                    key={`${r}-${c}`}
                    onPointerDown={(e) => handlePointerDown(e, r, c)}
                    className={`
                      relative flex items-center justify-center rounded-xl transition-colors select-none aspect-square cursor-pointer border
                      ${cellPathStyle ? cellPathStyle.bg : 'bg-slate-900/60'}
                      ${cellPathStyle ? cellPathStyle.border : 'border-slate-800/60'}
                      hover:border-slate-700
                    `}
                  >
                    {isDot && (
                      <div className="relative flex items-center justify-center">
                        <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full ${dotStyle.fill} shadow-lg ring-4 ring-slate-950 animate-pulse`} />
                        <span className="absolute inset-0 rounded-full border-2 border-white/60 animate-ping opacity-30" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Palette Selector & Status Bar */}
      <div className="space-y-4">
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[340px] bg-surface-2/80 border border-border-subtle p-3 rounded-2xl flex flex-col gap-2.5 shadow-inner">
            <div className="flex justify-between items-center text-caption font-semibold text-secondary px-1">
              <span>Drawing color palette</span>
              <button
                onClick={handleResetBoard}
                className="flex items-center gap-1 text-muted hover:text-primary transition-colors text-micro font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset all</span>
              </button>
            </div>

            {/* Colors picker with connection indicators */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((colorId) => {
                const cTheme = COLOR_MAP[colorId];
                const isSelected = selectedColor === colorId;
                const connected = isColorConnected(colorId);

                return (
                  <button
                    key={colorId}
                    onClick={() => {
                      setSelectedColor(colorId);
                      setErrorMsg('');
                    }}
                    className={`
                      py-2 px-1 rounded-xl border text-[0.75rem] font-semibold transition-all flex flex-col items-center justify-center gap-1 relative
                      ${isSelected
                        ? 'bg-surface-3 border-accent-brand text-primary shadow-md ring-2 ring-accent-brand/30'
                        : 'bg-surface-1/60 border-border-subtle text-secondary hover:bg-surface-2/60'
                      }
                    `}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`w-3.5 h-3.5 rounded-full ${cTheme.fill}`} />
                      {connected && (
                        <span className="text-[10px] text-feedback-success font-extrabold">✓</span>
                      )}
                    </div>
                    <span>{cTheme.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Button & Feedback */}
        <div className="space-y-3 max-w-[340px] mx-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-feedback-error/10 border border-feedback-error/20 text-feedback-error text-caption flex gap-2.5 items-start animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Check failed: </span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-feedback-success/10 border border-feedback-success/20 text-feedback-success text-caption flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Success: </span>
                <span>{successMsg}</span>
              </div>
            </div>
          )}

          <button
            onClick={checkPuzzleSolved}
            disabled={loading || !!successMsg}
            style={buttonBgStyle}
            className={`
              w-full py-3.5 rounded-2xl font-semibold text-caption shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50
              ${successMsg ? 'bg-feedback-success text-inverse' : 'hover:brightness-110'}
            `}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>Check puzzle</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Client-side helper functions
function isColorPathValid(colorId, paths, dots, rows, cols) {
  const path = paths[colorId];
  if (!path || path.length < 2) return { valid: false, reason: "Not connected" };

  const colorDots = dots.filter(([, , cid]) => cid === colorId);
  if (colorDots.length !== 2) return { valid: false, reason: "Endpoints missing" };
  const [dot1, dot2] = colorDots;

  const first = path[0];
  const last = path[path.length - 1];
  const connects1to2 = (first[0] === dot1[0] && first[1] === dot1[1] && last[0] === dot2[0] && last[1] === dot2[1]);
  const connects2to1 = (first[0] === dot2[0] && first[1] === dot2[1] && last[0] === dot1[0] && last[1] === dot1[1]);

  if (!connects1to2 && !connects2to1) {
    return { valid: false, reason: "Does not connect matching endpoints" };
  }

  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];

    if (r < 0 || r >= rows || c < 0 || c >= cols) {
      return { valid: false, reason: "Leaves the grid" };
    }

    if (i > 0) {
      const [pr, pc] = path[i - 1];
      const dist = Math.abs(r - pr) + Math.abs(c - pc);
      if (dist !== 1) {
        return { valid: false, reason: "Has non-adjacent moves" };
      }
    }

    const otherDot = dots.find(([dr, dc, cid]) => dr === r && dc === c && cid !== colorId);
    if (otherDot) {
      return { valid: false, reason: "Passes through another endpoint" };
    }
  }

  return { valid: true, reason: null };
}

function validateConnectDots(paths, dots, rows, cols) {
  const COLOR_NAMES = {
    1: 'Red',
    2: 'Blue',
    3: 'Green',
    4: 'Yellow'
  };

  for (let colorId = 1; colorId <= 4; colorId++) {
    const colorName = COLOR_NAMES[colorId];
    const res = isColorPathValid(colorId, paths, dots, rows, cols);
    if (!res.valid) {
      if (res.reason === "Not connected") {
        return { valid: false, reason: `${colorName} pair is not connected` };
      }
      return { valid: false, reason: `${colorName} path: ${res.reason.toLowerCase()}` };
    }
  }

  const occupied = {};
  for (let colorId = 1; colorId <= 4; colorId++) {
    const path = paths[colorId] || [];
    for (const [r, c] of path) {
      const key = `${r},${c}`;
      if (occupied[key] && occupied[key] !== colorId) {
        return {
          valid: false,
          reason: `Paths of ${COLOR_NAMES[occupied[key]]} and ${COLOR_NAMES[colorId]} overlap at (${r}, ${c})`
        };
      }
      occupied[key] = colorId;
    }
  }

  return { valid: true, reason: null };
}
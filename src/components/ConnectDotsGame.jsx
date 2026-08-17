import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, HelpCircle } from 'lucide-react';

export default function ConnectDotsGame({ teamId, colorTheme, gameData, onSolved, onIncorrect }) {
  const rows = gameData?.rows || 7;
  const cols = gameData?.cols || 7;

  // Dot positions (e.g. [[row, col, color_id], ...])
  // Colors: 1 = Red, 2 = Blue, 3 = Green, 4 = Yellow
  const initialDots = gameData?.dots || [
    [0, 1, 1], [4, 5, 1], // Red (1)
    [1, 5, 2], [5, 1, 2], // Blue (2)
    [2, 0, 3], [4, 2, 3], // Green (3)
    [3, 5, 4], [6, 2, 4]  // Yellow (4)
  ];

  // Map of color IDs to themes and CSS classes
  const COLOR_MAP = {
    0: { name: 'Empty', bg: 'bg-slate-900/60', text: 'text-slate-500', fill: 'bg-transparent', border: 'border-slate-800/80', hex: 'transparent' },
    1: { name: 'Red', bg: 'bg-red-500/10', text: 'text-red-400', fill: 'bg-red-500', border: 'border-red-500/30', hex: '#ef4444' },
    2: { name: 'Blue', bg: 'bg-blue-500/10', text: 'text-blue-400', fill: 'bg-blue-500', border: 'border-blue-500/30', hex: '#3b82f6' },
    3: { name: 'Green', bg: 'bg-emerald-500/10', text: 'text-emerald-400', fill: 'bg-emerald-500', border: 'border-emerald-500/30', hex: '#10b981' },
    4: { name: 'Yellow', bg: 'bg-amber-500/10', text: 'text-amber-400', fill: 'bg-amber-500', border: 'border-amber-500/30', hex: '#f59e0b' }
  };

  // Paths state: keys are color IDs (1-4)
  const [paths, setPaths] = useState(() => {
    const saved = localStorage.getItem(`krithohunt_connectdots_paths_${teamId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure all required keys exist
        return {
          1: parsed[1] || [],
          2: parsed[2] || [],
          3: parsed[3] || [],
          4: parsed[4] || []
        };
      } catch (e) {
        console.error(e);
      }
    }
    return { 1: [], 2: [], 3: [], 4: [] };
  });

  const [drawingColor, setDrawingColor] = useState(null); // colorId of active path being drawn
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const gridRef = useRef(null);

  // Persist paths state in localStorage
  useEffect(() => {
    localStorage.setItem(`krithohunt_connectdots_paths_${teamId}`, JSON.stringify(paths));
  }, [paths, teamId]);

  // Helper: check if a cell contains an initial fixed dot
  const getDotAtCell = (r, c) => {
    return initialDots.find(([dr, dc]) => dr === r && dc === c);
  };

  // Helper: check if cell is in any path of another color
  const isCellOccupiedByOtherPath = (r, c, excludeColorId) => {
    return Object.entries(paths).some(([cid, path]) => {
      if (parseInt(cid, 10) === excludeColorId) return false;
      return path.some(([pr, pc]) => pr === r && pc === c);
    });
  };

  // Start drawing path
  const handlePointerDown = (e, r, c) => {
    setErrorMsg('');
    const dot = getDotAtCell(r, c);
    if (!dot) return;

    const colorId = dot[2];
    setDrawingColor(colorId);

    // Initialize path with starting dot
    setPaths(prev => ({
      ...prev,
      [colorId]: [[r, c]]
    }));

    // Capture pointer to track dragging outside the container
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('Pointer capture failed:', err);
    }
  };

  // Handle drag movement
  const handlePointerMove = (e) => {
    if (drawingColor === null || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const cellW = rect.width / cols;
    const cellH = rect.height / rows;

    const c = Math.floor(x / cellW);
    const r = Math.floor(y / cellH);

    // Ignore if outside grid bounds
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;

    const currentPath = paths[drawingColor] || [];
    if (currentPath.length === 0) return;

    const lastCell = currentPath[currentPath.length - 1];
    if (r === lastCell[0] && c === lastCell[1]) return; // Same cell, no move

    // Orthogonal moves only
    const isAdjacent = Math.abs(r - lastCell[0]) + Math.abs(c - lastCell[1]) === 1;
    if (!isAdjacent) return;

    // Check backtracking (moving to the second to last cell in the current path)
    if (currentPath.length > 1) {
      const secondLastCell = currentPath[currentPath.length - 2];
      if (r === secondLastCell[0] && c === secondLastCell[1]) {
        // Backtrack: remove the last segment
        setPaths(prev => ({
          ...prev,
          [drawingColor]: currentPath.slice(0, -1)
        }));
        return;
      }
    }

    // Check if cell has another color's endpoint
    const dot = getDotAtCell(r, c);
    if (dot && dot[2] !== drawingColor) {
      return; // Cannot move through another color's endpoint
    }

    // Check if cell is occupied by another color's path
    if (isCellOccupiedByOtherPath(r, c, drawingColor)) {
      return; // Cannot overlap another color's path
    }

    // Check if cell is already in our own path (self-overlap/loop)
    const selfIdx = currentPath.findIndex(([pr, pc]) => pr === r && pc === c);
    if (selfIdx !== -1) {
      // Loop back to our own path: truncate the path back to this cell
      setPaths(prev => ({
        ...prev,
        [drawingColor]: currentPath.slice(0, selfIdx + 1)
      }));
      return;
    }

    // Check if matching target endpoint reached
    if (dot && dot[2] === drawingColor) {
      // Complete path
      setPaths(prev => ({
        ...prev,
        [drawingColor]: [...currentPath, [r, c]]
      }));
      setDrawingColor(null); // Finish drawing
      return;
    }

    // Otherwise, move to empty cell: extend path
    setPaths(prev => ({
      ...prev,
      [drawingColor]: [...currentPath, [r, c]]
    }));
  };

  const handlePointerUp = (e) => {
    setDrawingColor(null);
    try {
      if (e.target.hasPointerCapture(e.pointerId)) {
        e.target.releasePointerCapture(e.pointerId);
      }
    } catch (err) {
      // Ignore
    }
  };

  const handleResetBoard = () => {
    if (confirm('Are you sure you want to clear all your paths?')) {
      setPaths({ 1: [], 2: [], 3: [], 4: [] });
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  // Check if a path is fully connected according to rules
  const isColorConnected = (cid) => {
    return isColorPathValid(cid, paths, initialDots, rows, cols).valid;
  };

  const checkPuzzleSolved = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Run frontend validation for immediate feedback
    const clientVal = validateConnectDots(paths, initialDots, rows, cols);

    try {
      // Call secure database RPC submit_connect_dots
      const { data, error } = await supabase.rpc('submit_connect_dots', {
        p_team_id: teamId,
        p_paths: paths
      });

      if (error) throw error;

      if (data.success) {
        setSuccessMsg('🎉 Connect the Dots solved!');
        localStorage.removeItem(`krithohunt_connectdots_paths_${teamId}`);
        setTimeout(() => {
          onSolved();
        }, 1500);
      } else {
        const errorReason = data.error || clientVal.reason || 'Incorrect connections. Penalty count increased (+1)!';
        setErrorMsg(errorReason);
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
          CONNECT THE DOTS
        </h4>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Connect each matching pair without crossing another path. Drag from any colored dot to draw. Moves must be orthogonal. Drag backward to backtrack.
        </p>
      </div>

      {/* The Grid Board */}
      <div className="flex flex-col items-center select-none">
        <div 
          ref={gridRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            touchAction: 'none',
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: '2px'
          }}
          className="relative bg-slate-950/80 p-2.5 rounded-3xl border border-slate-800/80 shadow-inner w-full max-w-[340px] aspect-square"
        >
          {/* SVG path overlay */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none p-2.5"
            viewBox={`0 0 ${cols * 100} ${rows * 100}`}
          >
            {Object.entries(paths).map(([cid, path]) => {
              if (!path || path.length < 2) return null;
              const pathStr = path.map((cell, idx) => {
                const x = cell[1] * 100 + 50;
                const y = cell[0] * 100 + 50;
                return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
              }).join(' ');

              return (
                <path
                  key={cid}
                  d={pathStr}
                  stroke={COLOR_MAP[cid].hex}
                  strokeWidth={20}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  className="opacity-90"
                />
              );
            })}
          </svg>

          {/* Grid Cells */}
          {Array(rows).fill(null).map((_, r) =>
            Array(cols).fill(null).map((_, c) => {
              const dot = getDotAtCell(r, c);
              const isDot = !!dot;
              const colorId = isDot ? dot[2] : 0;
              const theme = COLOR_MAP[colorId];

              return (
                <div
                  key={`${r}-${c}`}
                  onPointerDown={(e) => handlePointerDown(e, r, c)}
                  className="relative flex items-center justify-center rounded-lg aspect-square border border-slate-900/60 bg-slate-900/30 transition-colors select-none focus:outline-none cursor-pointer"
                >
                  {isDot && (
                    <span 
                      className={`w-6 h-6 rounded-full ${theme.fill} shadow-lg ring-4 ring-slate-950 animate-pulse`} 
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Connection Status & Reset */}
      <div className="space-y-4">
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[340px] bg-slate-950/60 border border-slate-850/80 p-3 rounded-2xl flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 px-1">
              <span>Connection Status</span>
              <button 
                onClick={handleResetBoard}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Grid</span>
              </button>
            </div>

            {/* Colors picker / status indicator */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((colorId) => {
                const cTheme = COLOR_MAP[colorId];
                const connected = isColorConnected(colorId);
                return (
                  <div
                    key={colorId}
                    className={`
                      py-2 rounded-xl border text-[9px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-1
                      ${connected 
                        ? 'bg-slate-900/80 border-slate-700/80 text-white shadow-lg' 
                        : 'bg-slate-950/40 border-slate-900/80 text-slate-500'
                      }
                    `}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${cTheme.fill} flex items-center justify-center text-[8px] text-slate-950`}>
                      {connected && '✓'}
                    </span>
                    <span>{cTheme.name}</span>
                  </div>
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
              w-full py-4 rounded-2xl text-slate-950 font-bold text-xs tracking-wider uppercase shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer
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

// Standalone rule-based validation helper functions
function isColorPathValid(colorId, paths, dots, rows, cols) {
  const path = paths[colorId];
  if (!path || path.length < 2) return { valid: false, reason: "Not connected" };
  
  const colorDots = dots.filter(([,, cid]) => cid === colorId);
  if (colorDots.length !== 2) return { valid: false, reason: "Endpoints missing" };
  const [dot1, dot2] = colorDots;

  // Check endpoints match
  const first = path[0];
  const last = path[path.length - 1];
  const connects1to2 = (first[0] === dot1[0] && first[1] === dot1[1] && last[0] === dot2[0] && last[1] === dot2[1]);
  const connects2to1 = (first[0] === dot2[0] && first[1] === dot2[1] && last[0] === dot1[0] && last[1] === dot1[1]);
  
  if (!connects1to2 && !connects2to1) {
    return { valid: false, reason: "Does not connect matching endpoints" };
  }

  // Check path steps
  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    
    // Bounds check
    if (r < 0 || r >= rows || c < 0 || c >= cols) {
      return { valid: false, reason: "Leaves the grid" };
    }

    // Orthogonal adjacency check
    if (i > 0) {
      const [pr, pc] = path[i - 1];
      const dist = Math.abs(r - pr) + Math.abs(c - pc);
      if (dist !== 1) {
        return { valid: false, reason: "Has non-adjacent moves" };
      }
    }

    // Pass through other endpoints check
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

  // Check overlaps
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

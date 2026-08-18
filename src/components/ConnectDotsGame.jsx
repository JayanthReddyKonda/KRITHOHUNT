import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { GameCell, Card, Button } from '@/components/primitives';

export default function ConnectDotsGame({ teamId, colorTheme, gameData, onSolved, onIncorrect }) {
  const rows = gameData?.rows || 7;
  const cols = gameData?.cols || 7;

  const initialDots = gameData?.dots || [
    [0, 1, 1], [4, 5, 1],
    [1, 5, 2], [5, 1, 2],
    [2, 0, 3], [4, 2, 3],
    [3, 5, 4], [6, 2, 4]
  ];

  const COLOR_MAP = {
    0: { name: 'Empty', accent: 'violet' },
    1: { name: 'Red', accent: 'rose' },
    2: { name: 'Blue', accent: 'cyan' },
    3: { name: 'Green', accent: 'emerald' },
    4: { name: 'Yellow', accent: 'amber' }
  };

  const [paths, setPaths] = useState(() => {
    const saved = localStorage.getItem(`krithohunt_connectdots_paths_${teamId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
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

  const [drawingColor, setDrawingColor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const gridRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(`krithohunt_connectdots_paths_${teamId}`, JSON.stringify(paths));
  }, [paths, teamId]);

  const getDotAtCell = (r, c) => {
    return initialDots.find(([dr, dc]) => dr === r && dc === c);
  };

  const isCellOccupiedByOtherPath = (r, c, excludeColorId) => {
    return Object.entries(paths).some(([cid, path]) => {
      if (parseInt(cid, 10) === excludeColorId) return false;
      return path.some(([pr, pc]) => pr === r && pc === c);
    });
  };

  const handlePointerDown = (e, r, c) => {
    setErrorMsg('');
    const dot = getDotAtCell(r, c);
    if (!dot) return;

    const colorId = dot[2];
    setDrawingColor(colorId);

    setPaths(prev => ({
      ...prev,
      [colorId]: [[r, c]]
    }));

    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (err) {
      if (import.meta.env.DEV) console.debug('Pointer capture failed:', err);
    }
  };

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

    if (r < 0 || r >= rows || c < 0 || c >= cols) return;

    const currentPath = paths[drawingColor] || [];
    if (currentPath.length === 0) return;

    const lastCell = currentPath[currentPath.length - 1];
    if (r === lastCell[0] && c === lastCell[1]) return;

    const isAdjacent = Math.abs(r - lastCell[0]) + Math.abs(c - lastCell[1]) === 1;
    if (!isAdjacent) return;

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

    const dot = getDotAtCell(r, c);
    if (dot && dot[2] !== drawingColor) {
      return;
    }

    if (isCellOccupiedByOtherPath(r, c, drawingColor)) {
      return;
    }

    const selfIdx = currentPath.findIndex(([pr, pc]) => pr === r && pc === c);
    if (selfIdx !== -1) {
      setPaths(prev => ({
        ...prev,
        [drawingColor]: currentPath.slice(0, selfIdx + 1)
      }));
      return;
    }

    if (dot && dot[2] === drawingColor) {
      setPaths(prev => ({
        ...prev,
        [drawingColor]: [...currentPath, [r, c]]
      }));
      setDrawingColor(null);
      return;
    }

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
    } catch {
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

  const isColorConnected = (cid) => {
    return isColorPathValid(cid, paths, initialDots, rows, cols).valid;
  };

  const checkPuzzleSolved = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const clientVal = validateConnectDots(paths, initialDots, rows, cols);

    try {
      const { data, error } = await supabase.rpc('submit_connect_dots', {
        p_team_id: teamId,
        p_paths: paths
      });

      if (error) throw error;

      if (data.success) {
        setSuccessMsg('Connect the Dots solved!');
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

  const accentColor = `hsl(var(--accent-${colorTheme?.accent || 'brand'}))`;

  return (
    <div className="space-y-5">
      <Card variant="panel" padding="md" className="space-y-2">
        <h4 className="text-caption font-bold text-muted uppercase tracking-wider">
          Connect the Dots
        </h4>
        <p className="text-body-sm text-secondary leading-relaxed">
          Connect each matching pair without crossing another path. Drag from any colored dot to draw. Moves must be orthogonal. Drag backward to backtrack.
        </p>
      </Card>

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
          className="relative w-full max-w-[340px] aspect-square"
        >
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none p-2.5"
            viewBox={`0 0 ${cols * 100} ${rows * 100}`}
            role="img"
            aria-label="Connection paths"
          >
            {Object.entries(paths).map(([cid, path]) => {
              if (!path || path.length < 2) return null;
              const pathStr = path.map((cell, idx) => {
                const x = cell[1] * 100 + 50;
                const y = cell[0] * 100 + 50;
                return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
              }).join(' ');

              const accentKey = COLOR_MAP[cid]?.accent || 'violet';
              const isYellowOrOrange = accentKey === 'yellow' || accentKey === 'orange';
              const strokeColor = `hsl(var(--accent-${accentKey}))`;

              return (
                <path
                  key={cid}
                  d={pathStr}
                  stroke={strokeColor}
                  strokeWidth={isYellowOrOrange ? 22 : 20}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                    stroke: isYellowOrOrange ? 'hsl(var(--text-inverse))' : strokeColor
                  }}
                  className="opacity-90"
                />
              );
            })}
          </svg>

          {Array(rows).fill(null).map((_, r) =>
            Array(cols).fill(null).map((_, c) => {
              const dot = getDotAtCell(r, c);
              const isDot = !!dot;
              const colorId = isDot ? dot[2] : 0;
              const accentKey = COLOR_MAP[colorId]?.accent || 'violet';
              const isYellowOrOrange = accentKey === 'yellow' || accentKey === 'orange';
              const bgColor = `hsl(var(--accent-${accentKey}))`;
              const textColor = isYellowOrOrange ? 'hsl(var(--text-inverse))' : 'hsl(var(--text-primary))';

              return (
                <GameCell
                  key={`${r}-${c}`}
                  variant={isDot ? 'filled' : 'default'}
                  onPointerDown={(e) => handlePointerDown(e, r, c)}
                  disabled={!isDot}
                  className="touch-target aspect-square"
                  style={{
                    backgroundColor: isDot ? bgColor : undefined,
                    color: isDot ? textColor : undefined
                  }}
                  aria-label={isDot ? `${COLOR_MAP[colorId].name} endpoint, row ${r + 1}, column ${c + 1}` : `Empty cell, row ${r + 1}, column ${c + 1}`}
                >
                  {isDot && (
                    <span className="w-5 h-5 rounded-full bg-current/20 ring-2 ring-current/30 animate-pulse" aria-hidden="true" />
                  )}
                </GameCell>
              );
            })
          )}
        </div>
      </div>

      <Card variant="panel" padding="md" className="space-y-4 max-w-[340px] w-full mx-auto">
        <div className="flex justify-between items-center text-micro font-bold text-muted px-1">
          <span>Connection Status</span>
          <Button variant="ghost" size="sm" onClick={handleResetBoard} aria-label="Reset grid">
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Grid</span>
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Path status">
          {[1, 2, 3, 4].map((colorId) => {
            const cTheme = COLOR_MAP[colorId];
            const connected = isColorConnected(colorId);
            const accentKey = cTheme.accent;
            const isYellowOrOrange = accentKey === 'yellow' || accentKey === 'orange';
            const bgColor = `hsl(var(--accent-${accentKey}))`;
            const textColor = isYellowOrOrange ? 'hsl(var(--text-inverse))' : 'hsl(var(--text-primary))';

            return (
              <div
                key={colorId}
                className={`
                  py-3 rounded-xl border text-micro font-bold uppercase transition-all flex flex-col items-center justify-center gap-1.5
                  ${connected
                    ? 'bg-surface-1 border-border-strong text-primary shadow-lg'
                    : 'bg-surface-2 border-border-subtle text-secondary'
                  }
                `}
                style={{ backgroundColor: connected ? `hsl(var(--surface-1))` : `hsl(var(--surface-2))` }}
                role="status"
                aria-label={`${cTheme.name} path ${connected ? 'connected' : 'not connected'}`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-micro font-black ${connected ? 'ring-2 ring-current' : ''}`}
                  style={{
                    backgroundColor: bgColor,
                    color: textColor
                  }}
                >
                  {connected && '✓'}
                </span>
                <span className="text-caption">{cTheme.name}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="space-y-3 max-w-[340px] w-full mx-auto">
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
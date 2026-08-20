import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';


export default function TowerOfHanoiGame({ teamId, colorTheme, onSolved, onIncorrect }) {
  const storageKey = `krithohunt_hanoi_${teamId}`;
  const [pegs, setPegs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      return saved?.pegs || { 0: [3, 2, 1], 1: [], 2: [] };
    } catch {
      return { 0: [3, 2, 1], 1: [], 2: [] };
    }
  });

  const [selectedPeg, setSelectedPeg] = useState(null);
  const [moves, setMoves] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null')?.moves || 0; } catch { return 0; }
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const submissionAttemptedRef = useRef(false);

  const isSolved = pegs[2].length === 3 && pegs[2][0] === 3 && pegs[2][1] === 2 && pegs[2][2] === 1;

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ pegs, moves }));
  }, [pegs, moves, storageKey]);

  useEffect(() => {
    if (isSolved && !successMsg && !loading && !submissionAttemptedRef.current) {
      submissionAttemptedRef.current = true;
      const submitSolution = async () => {
        setLoading(true);
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const hanoiPenalty = Math.max(0, moves - 7);

          if (hanoiPenalty > 0) {
            for (let i = 0; i < hanoiPenalty; i++) {
              await supabase.rpc('submit_team_answer', {
                p_team_id: teamId,
                p_answer: 'wrong'
              });
            }
          }

          const { data, error } = await supabase.rpc('submit_team_answer', {
            p_team_id: teamId,
            p_answer: 'hanoi_solved'
          });

          if (error) throw error;

          if (data.success) {
            localStorage.removeItem(storageKey);
            const penaltyNotice = hanoiPenalty > 0 ? ` (+${hanoiPenalty} penalty)` : '';
            setSuccessMsg(`Tower of Hanoi solved!\nYou solved it in ${moves} moves${penaltyNotice}.`);
            setTimeout(() => {
              onSolved();
            }, 2000);
          } else {
            setErrorMsg(data.error || 'Submission failed.');
            if (onIncorrect) onIncorrect();
          }
        } catch (err) {
          console.error(err);
          setErrorMsg(err.message || 'Connection error. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      submitSolution();
    }
  }, [isSolved, teamId, moves, successMsg, loading, onSolved, onIncorrect, storageKey]);

  const handlePegClick = (pegIdx) => {
    if (successMsg || loading) return;

    if (selectedPeg === null) {
      if (pegs[pegIdx].length === 0) {
        setErrorMsg('Select a tower containing disks.');
        return;
      }
      setSelectedPeg(pegIdx);
      setErrorMsg('');
    } else {
      if (selectedPeg === pegIdx) {
        setSelectedPeg(null);
        return;
      }

      const sourcePegDisks = pegs[selectedPeg];
      const targetPegDisks = pegs[pegIdx];
      const movingDisk = sourcePegDisks[sourcePegDisks.length - 1];

      const topTargetDisk = targetPegDisks[targetPegDisks.length - 1];
      if (topTargetDisk && movingDisk > topTargetDisk) {
        setErrorMsg('Invalid move — a larger disk cannot go on a smaller disk.');
        setSelectedPeg(null);
        return;
      }

      const newSource = [...sourcePegDisks];
      newSource.pop();

      const newTarget = [...targetPegDisks, movingDisk];

      setPegs({
        ...pegs,
        [selectedPeg]: newSource,
        [pegIdx]: newTarget
      });

      setMoves(prev => prev + 1);
      setSelectedPeg(null);
      setErrorMsg('');
    }
  };

  const handleResetBoard = () => {
    submissionAttemptedRef.current = false;
    setPegs({
      0: [3, 2, 1],
      1: [],
      2: []
    });
    setSelectedPeg(null);
    setMoves(0);
    setErrorMsg('');
    setSuccessMsg('');
    localStorage.removeItem(storageKey);
  };

  const DISK_COLORS = {
    1: 'bg-accent-emerald',
    2: 'bg-accent-cyan',
    3: 'bg-accent-violet'
  };

  const accentColor = `hsl(var(--accent-${colorTheme?.accent || 'violet'}))`;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-brand">Puzzle 4</p>
        <h4 className="text-[1.05rem] font-semibold text-primary">Tower of Hanoi</h4>
        <p className="text-[0.8125rem] text-secondary mt-0.5">Move all 3 disks from A to C. Larger disks cannot go on smaller ones. Complete the game in minimum 7 moves, extra moves add +1 penalty.</p>
      </div>

      <div className="flex flex-col items-center select-none w-full">
        <div
          style={{ width: 'min(calc(100vw - 48px), 320px)' }}
          className="p-4 rounded-xl bg-surface-2/30 border border-border-subtle/40 shadow-inner mx-auto"
        >
          <div className="flex justify-between items-center text-[11px] font-medium text-muted mb-3">
            <span>
              {successMsg
                ? 'Solved!'
                : selectedPeg !== null
                  ? 'Now tap the target tower'
                  : 'Tap a tower to pick up the top disk'}
            </span>
            <button
              type="button"
              onClick={handleResetBoard}
              disabled={loading || !!successMsg}
              className="flex items-center gap-1 text-muted hover:text-secondary transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          <div className="flex justify-around items-end h-[200px] relative px-1 pt-4 pb-2">
            {[0, 1, 2].map((pegIdx) => {
              const diskList = pegs[pegIdx];
              const isSelected = selectedPeg === pegIdx;
              const towerName = pegIdx === 0 ? 'A' : pegIdx === 1 ? 'B' : 'C';

              return (
                <button
                  key={pegIdx}
                  type="button"
                  onClick={() => handlePegClick(pegIdx)}
                  className="group relative flex h-full w-[31%] cursor-pointer flex-col items-center justify-end rounded-xl border border-transparent bg-transparent px-0 pb-1 text-primary transition-colors hover:border-border-subtle focus-visible:border-accent-brand"
                  aria-label={isSelected ? `Tower ${towerName} selected, tap to move disk` : `Tower ${towerName}, ${diskList.length} disks, tap to select`}
                >
                  <div
                    className={`absolute bottom-2 w-1.5 h-[150px] rounded-full transition-all duration-base ${isSelected ? '' : 'bg-border-subtle group-hover:bg-border-strong'}`}
                    style={isSelected ? { backgroundColor: accentColor } : undefined}
                  />

                  <div className="flex flex-col-reverse items-center gap-2 w-full z-10 pb-2">
                    {diskList.map((diskValue, dIdx) => {
                      const isTop = dIdx === diskList.length - 1;
                      const isDiskSelected = isSelected && isTop;
                      const diskColor = DISK_COLORS[diskValue];
                      const widthPercent = diskValue === 1 ? '52%' : diskValue === 2 ? '76%' : '100%';

                      return (
                        <div
                          key={diskValue}
                          className={`min-h-[36px] w-full flex items-center justify-center rounded-md text-[0.8125rem] font-semibold transition-all select-none ${diskColor} text-inverse`}
                          style={{
                            width: widthPercent,
                            ...(isDiskSelected
                              ? { transform: 'translateY(-12px) scale(1.04)', zIndex: 10 }
                              : {})
                          }}
                        >
                          {diskValue}
                        </div>
                      );
                    })}
                  </div>

                  <div className="absolute -bottom-6 text-micro font-semibold text-secondary group-hover:text-primary transition-colors uppercase">
                    {towerName}
                  </div>
                </button>
              );
            })}

            <div className="absolute bottom-1 left-0 right-0 h-2 bg-surface-0 border-t border-border-subtle rounded-full" />
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-6 text-[11px] font-semibold uppercase tracking-wide text-muted mt-1">
        <div>Moves: <span className="text-primary">{moves}</span></div>
        <div>Minimum: <span className="text-muted">7</span></div>
      </div>

      <div className="space-y-2.5">
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-feedback-error/10 border border-feedback-error/20 text-feedback-error text-[0.8125rem] animate-shake" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-feedback-success/15 border border-feedback-success/25 text-feedback-success text-[0.8125rem]" role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{successMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
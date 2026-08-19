import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { AlertTriangle, CheckCircle2, RotateCcw, MoveRight } from 'lucide-react';
import { Card, Button } from '@/components/primitives';

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
          const { data, error } = await supabase.rpc('submit_team_answer', {
            p_team_id: teamId,
            p_answer: 'hanoi_solved'
          });

          if (error) throw error;

          if (data.success) {
            localStorage.removeItem(storageKey);
            setSuccessMsg(`Tower of Hanoi solved!\nYou solved it in ${moves} moves.`);
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
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-micro font-bold uppercase tracking-[0.16em] text-accent-brand">Puzzle 4</p>
          <h4 className="text-h2 font-black text-primary tracking-tight">Tower of Hanoi</h4>
          <p className="mt-1 text-body-sm text-secondary leading-relaxed">Move every disk from A to C. Never place a larger disk on a smaller one.</p>
        </div>
        <div className="shrink-0 rounded-xl border border-border-subtle bg-surface-2 p-2.5 text-accent-brand" aria-hidden="true">
          <MoveRight className="h-5 w-5" />
        </div>
      </div>
      <Card variant="panel" padding="md" className="space-y-1.5">
        <ul className="text-body-sm text-secondary space-y-1 list-disc list-inside">
          <li>Move one top disk at a time.</li>
          <li className="font-bold text-accent-amber text-inverse bg-accent-amber/20 px-1.5 py-0.5 rounded inline-block">
            A larger disk cannot be placed on top of a smaller disk.
          </li>
        </ul>
      </Card>

      <div className="flex flex-col items-center select-none">
        <Card variant="elevated" padding="lg" className="w-full max-w-[340px]">
          <div className="flex justify-between items-center text-micro font-bold text-muted px-1 mb-4">
            <span>
              {successMsg
                ? 'Solved!'
                : selectedPeg !== null
                  ? 'Select destination tower'
                  : 'Tap a tower to select top disk'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetBoard}
              disabled={loading || !!successMsg}
              aria-label="Reset game"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>

          <div className="flex justify-around items-end h-[260px] relative px-1 pt-5 pb-2">
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
                    className={`absolute bottom-2 w-2 h-[185px] rounded-full transition-all duration-base ${isSelected ? 'shadow-[0_0_12px_hsl(var(--accent-brand)_/_0.5)]' : 'bg-border-subtle group-hover:bg-border-strong'}`}
                    style={isSelected ? { backgroundColor: accentColor } : undefined}
                  />

                  <div className="flex flex-col-reverse items-center gap-2 w-full z-10 pb-2">
                    {diskList.map((diskValue, dIdx) => {
                      const isTop = dIdx === diskList.length - 1;
                      const isDiskSelected = isSelected && isTop;
                      const diskColor = DISK_COLORS[diskValue];

                      const widthMap = { 1: 'w-16', 2: 'w-24', 3: 'w-32' };
                      const minHeight = 'min-h-[44px]';

                      return (
                        <div
                          key={diskValue}
                          className={`${widthMap[diskValue]} ${minHeight} flex items-center justify-center rounded-lg text-body font-black transition-all select-none ${diskColor} text-inverse`}
                          style={
                            isDiskSelected
                              ? {
                                transform: 'translateY(-16px) scale(1.05)',
                                boxShadow: '0 12px 24px rgba(0,0,0,0.3)',
                                zIndex: 10
                              }
                              : {}
                          }
                        >
                          {diskValue}
                        </div>
                      );
                    })}
                  </div>

                  <div className="absolute -bottom-6 text-micro font-bold text-secondary group-hover:text-primary transition-colors uppercase">
                    {towerName}
                  </div>
                </button>
              );
            })}

            <div className="absolute bottom-1 left-0 right-0 h-2 bg-surface-0 border-t border-border-subtle rounded-full" />
          </div>
        </Card>
      </div>

      <div className="flex justify-center gap-6 text-caption font-bold uppercase tracking-wider text-secondary">
        <div>Moves: <span className="text-primary">{moves}</span></div>
        <div>Minimum: <span className="text-muted">7</span></div>
      </div>

      <div className="space-y-3 max-w-[340px] w-full mx-auto">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-feedback-error/10 border border-feedback-error/20 text-feedback-error text-body-sm flex gap-2.5 items-start animate-shake" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-feedback-success/10 border border-feedback-success/20 text-feedback-success text-body-sm flex gap-2.5 items-start" role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-bold">Success: </span>
              <span className="whitespace-pre-line">{successMsg}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
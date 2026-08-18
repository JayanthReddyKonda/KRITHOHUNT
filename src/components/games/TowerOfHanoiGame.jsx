import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { Card, Button, GameCell } from '@/components/primitives';

export default function TowerOfHanoiGame({ teamId, _colorTheme, onSolved, onIncorrect }) {
  const [pegs, setPegs] = useState({
    0: [3, 2, 1],
    1: [],
    2: []
  });

  const [selectedPeg, setSelectedPeg] = useState(null);
  const [moves, setMoves] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isSolved = pegs[2].length === 3 && pegs[2][0] === 3 && pegs[2][1] === 2 && pegs[2][2] === 1;

  useEffect(() => {
    if (isSolved && !successMsg && !loading) {
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
  }, [isSolved, teamId, moves, successMsg, loading, onSolved, onIncorrect]);

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
    setPegs({
      0: [3, 2, 1],
      1: [],
      2: []
    });
    setSelectedPeg(null);
    setMoves(0);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const DISK_COLORS = {
    1: 'accent-green',
    2: 'accent-blue',
    3: 'accent-purple'
  };

  const accentColor = `hsl(var(--accent-${colorTheme?.accent || 'indigo'}))`;

  return (
    <div className="space-y-5">
      <Card variant="panel" padding="md" className="space-y-2">
        <h4 className="text-caption font-bold text-muted uppercase tracking-wider">
          Game 4: Tower of Hanoi
        </h4>
        <p className="text-body-sm text-secondary leading-relaxed">
          Move all 3 disks from <strong className="text-primary">Tower A</strong> to <strong className="text-primary">Tower C</strong> using Tower B as intermediate.
        </p>
        <ul className="text-body-sm text-secondary space-y-1 list-disc list-inside">
          <li>Move only one disk at a time.</li>
          <li>Only move the top disk from a tower.</li>
          <li className="font-bold text-accent-yellow text-inverse bg-accent-yellow/20 px-1.5 py-0.5 rounded inline-block">
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

          <div className="flex justify-around items-end h-[280px] relative px-2 pt-6 pb-2">
            {[0, 1, 2].map((pegIdx) => {
              const diskList = pegs[pegIdx];
              const isSelected = selectedPeg === pegIdx;
              const towerName = pegIdx === 0 ? 'A' : pegIdx === 1 ? 'B' : 'C';

              return (
                <div
                  key={pegIdx}
                  onClick={() => handlePegClick(pegIdx)}
                  className="relative flex flex-col items-center justify-end h-full w-24 cursor-pointer group"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePegClick(pegIdx); }}
                  aria-label={isSelected ? `Tower ${towerName} selected, tap to move disk` : `Tower ${towerName}, ${diskList.length} disks, tap to select`}
                >
                  <div className={`
                    absolute bottom-2 w-2 h-[200px] rounded-full transition-all duration-base
                    ${isSelected ? `bg-[${accentColor}] shadow-[0_0_12px_${accentColor}/0.5]` : 'bg-border-subtle group-hover:bg-border-strong'}
                  `} />

                  <div className="flex flex-col-reverse items-center gap-2 w-full z-10 pb-2">
                    {diskList.map((diskValue, dIdx) => {
                      const isTop = dIdx === diskList.length - 1;
                      const isDiskSelected = isSelected && isTop;
                      const diskColor = DISK_COLORS[diskValue];

                      const widthMap = { 1: 'w-16', 2: 'w-24', 3: 'w-32' };
                      const minHeight = 'min-h-[44px]';

                      return (
                        <GameCell
                          key={diskValue}
                          variant={isDiskSelected ? 'selected' : 'filled'}
                          disabled={!isTop || successMsg || loading}
                          className={`${widthMap[diskValue]} ${minHeight} text-body font-black transition-all select-none ${diskColor} text-inverse`}
                          style={
                            isDiskSelected
                              ? {
                                  transform: 'translateY(-16px) scale(1.05)',
                                  boxShadow: '0 12px 24px rgba(0,0,0,0.3)',
                                  zIndex: 10
                                }
                              : {}
                          }
                          aria-label={isDiskSelected ? `Disk ${diskValue} selected from Tower ${towerName}` : `Disk ${diskValue} on Tower ${towerName}`}
                        >
                          {diskValue}
                        </GameCell>
                      );
                    })}
                  </div>

                  <div className="absolute -bottom-6 text-micro font-bold text-secondary group-hover:text-primary transition-colors uppercase">
                    Tower {towerName}
                  </div>
                </div>
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
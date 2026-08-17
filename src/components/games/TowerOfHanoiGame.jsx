import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';

export default function TowerOfHanoiGame({ teamId, onSolved, onIncorrect }) {
  // Pegs: 0 = Tower A (Left), 1 = Tower B (Middle), 2 = Tower C (Right)
  // Disks: 3 = Large, 2 = Medium, 1 = Small
  const [pegs, setPegs] = useState({
    0: [3, 2, 1], // Start stacked on A
    1: [],
    2: []
  });

  const [selectedPeg, setSelectedPeg] = useState(null); // index 0, 1, or 2
  const [moves, setMoves] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Check if puzzle is solved (all 3 disks on C [peg index 2] in correct order: [3, 2, 1])
  const isSolved = pegs[2].length === 3 && pegs[2][0] === 3 && pegs[2][1] === 2 && pegs[2][2] === 1;

  // Auto-submit when solved
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
            setSuccessMsg(`🎉 TOWER OF HANOI SOLVED!\nYou solved it in ${moves} moves.`);
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
      // Step 1: Select top disk from source peg
      if (pegs[pegIdx].length === 0) {
        setErrorMsg('Select a tower containing disks.');
        return;
      }
      setSelectedPeg(pegIdx);
      setErrorMsg('');
    } else {
      // Step 2: Move disk to destination peg
      if (selectedPeg === pegIdx) {
        setSelectedPeg(null); // Cancel selection
        return;
      }

      const sourcePegDisks = pegs[selectedPeg];
      const targetPegDisks = pegs[pegIdx];
      const movingDisk = sourcePegDisks[sourcePegDisks.length - 1]; // Top disk of source

      // Tower of Hanoi rule check: larger disk cannot go on top of a smaller disk
      const topTargetDisk = targetPegDisks[targetPegDisks.length - 1];
      if (topTargetDisk && movingDisk > topTargetDisk) {
        setErrorMsg('Invalid move — a larger disk cannot go on a smaller disk.');
        setSelectedPeg(null); // Reset selection
        return;
      }

      // Valid move execution
      const newSource = [...sourcePegDisks];
      newSource.pop();

      const newTarget = [...targetPegDisks, movingDisk];

      setPegs({
        ...pegs,
        [selectedPeg]: newSource,
        [pegIdx]: newTarget
      });

      setMoves(prev => prev + 1);
      setSelectedPeg(null); // Clear selection
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

  // Visual styling for disks of different sizes
  const DISK_STYLES = {
    1: 'w-16 bg-sky-400 border-sky-300',
    2: 'w-24 bg-indigo-500 border-indigo-400',
    3: 'w-32 bg-indigo-700 border-indigo-600'
  };

  return (
    <div className="space-y-6">
      {/* Game Rules & Instruction */}
      <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 text-left space-y-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Game 4: Tower of Hanoi
        </h4>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Move all 3 disks from <strong className="text-slate-200">Tower A</strong> to <strong className="text-slate-200">Tower C</strong> using Tower B as intermediate.
        </p>
        <ul className="text-[10px] text-slate-500 space-y-1 list-disc list-inside">
          <li>Move only one disk at a time.</li>
          <li>Only move the top disk from a tower.</li>
          <li className="font-bold text-amber-500">
            ⚠️ A larger disk cannot be placed on top of a smaller disk.
          </li>
        </ul>
      </div>

      {/* Visual Hanoi Board */}
      <div className="flex flex-col items-center select-none">
        <div className="w-full max-w-[340px] bg-slate-950/45 p-5 rounded-3xl border border-slate-850 shadow-inner flex flex-col gap-6">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 px-1">
            <span>
              {successMsg 
                ? 'Solved!' 
                : selectedPeg !== null 
                  ? 'Select destination tower' 
                  : 'Tap a tower to select top disk'
              }
            </span>
            <button 
              onClick={handleResetBoard}
              disabled={loading || !!successMsg}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-400 transition-colors disabled:opacity-30"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Peg columns container */}
          <div className="flex justify-around items-end h-44 relative px-2 pt-6 pb-2">
            {[0, 1, 2].map((pegIdx) => {
              const diskList = pegs[pegIdx];
              const isSelected = selectedPeg === pegIdx;
              const towerName = pegIdx === 0 ? 'A' : pegIdx === 1 ? 'B' : 'C';

              return (
                <div 
                  key={pegIdx}
                  onClick={() => handlePegClick(pegIdx)}
                  className="relative flex flex-col items-center justify-end h-full w-24 cursor-pointer group"
                >
                  {/* Vertical Peg Rod */}
                  <div className={`
                    absolute bottom-2 w-1.5 h-32 rounded-full transition-all duration-300
                    ${isSelected ? 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]' : 'bg-slate-800 group-hover:bg-slate-700'}
                  `} />

                  {/* Disks stacked vertically */}
                  <div className="flex flex-col-reverse items-center gap-1.5 w-full z-10 pb-2">
                    {diskList.map((diskValue, dIdx) => {
                      const isTop = dIdx === diskList.length - 1;
                      const isDiskSelected = isSelected && isTop;

                      return (
                        <div
                          key={diskValue}
                          className={`
                            h-6 border rounded-lg shadow-md flex items-center justify-center text-[10px] font-black text-slate-950/80 transition-all select-none
                            ${DISK_STYLES[diskValue]}
                            ${isDiskSelected ? 'translate-y-[-16px] scale-105 shadow-xl ring-2 ring-white/20' : ''}
                          `}
                        >
                          {diskValue}
                        </div>
                      );
                    })}
                  </div>

                  {/* Tower label */}
                  <div className="absolute -bottom-5 text-[10px] font-bold text-slate-500 group-hover:text-slate-400 transition-colors uppercase">
                    Tower {towerName}
                  </div>
                </div>
              );
            })}

            {/* Base Stand Bar */}
            <div className="absolute bottom-1 left-0 right-0 h-1.5 bg-slate-900 border-t border-slate-850 rounded-full" />
          </div>
        </div>
      </div>

      {/* Info Status (Moves Counters) */}
      <div className="flex justify-center gap-6 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <div>Moves: <span className="text-white">{moves}</span></div>
        <div>Minimum: <span className="text-slate-400">7</span></div>
      </div>

      {/* Feedback Alerts */}
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2.5 items-start animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2.5 items-start">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
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

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';

export default function TowerOfHanoiGame({ teamId, colorTheme, _gameData, onSolved, onIncorrect }) {
  // Pegs: 0 = Left, 1 = Middle, 2 = Right
  // Disks: 3 = Large, 2 = Medium, 1 = Small
  const [pegs, setPegs] = useState({
    0: [3, 2, 1], // Start stacked on Left peg
    1: [],
    2: []
  });

  const [selectedPeg, setSelectedPeg] = useState(null); // index 0, 1, or 2
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Check if puzzle is solved (all 3 disks on Right peg in order: [3, 2, 1])
  const isSolved = pegs[2].length === 3 && pegs[2][0] === 3 && pegs[2][1] === 2 && pegs[2][2] === 1;

  const handlePegClick = (pegIdx) => {
    if (successMsg) return;

    if (selectedPeg === null) {
      // Step A: Select top disk of clicked peg
      if (pegs[pegIdx].length === 0) {
        setErrorMsg('Select a peg containing disks.');
        return;
      }
      setSelectedPeg(pegIdx);
      setErrorMsg('');
    } else {
      // Step B: Move disk from selectedPeg to clicked peg
      if (selectedPeg === pegIdx) {
        setSelectedPeg(null); // Cancel selection
        return;
      }

      const sourcePegDisks = pegs[selectedPeg];
      const targetPegDisks = pegs[pegIdx];
      const movingDisk = sourcePegDisks[sourcePegDisks.length - 1]; // Top disk of source

      // Enforce Tower of Hanoi rule: Cannot place a larger disk on a smaller disk
      const topTargetDisk = targetPegDisks[targetPegDisks.length - 1];
      if (topTargetDisk && movingDisk > topTargetDisk) {
        setErrorMsg('Invalid move: A larger disk cannot be placed on a smaller disk.');
        setSelectedPeg(null); // Reset selection
        return;
      }

      // Execute move
      const newSource = [...sourcePegDisks];
      newSource.pop();

      const newTarget = [...targetPegDisks, movingDisk];

      setPegs({
        ...pegs,
        [selectedPeg]: newSource,
        [pegIdx]: newTarget
      });

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
    setErrorMsg('');
    setSuccessMsg('');
  };

  const submitHanoiSolved = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Answer is 'hanoi_solved'
      const { data, error } = await supabase.rpc('submit_team_answer', {
        p_team_id: teamId,
        p_answer: 'hanoi_solved'
      });

      if (error) throw error;

      if (data.success) {
        setSuccessMsg('🎉 Tower of Hanoi complete!');
        setTimeout(() => {
          onSolved();
        }, 1500);
      } else {
        setErrorMsg(data.error || 'Submission failed. Penalty count increased (+1)!');
        onIncorrect();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Color classes mapping for disks
  const DISK_STYLES = {
    1: 'w-[60px] bg-sky-400 border-sky-300',
    2: 'w-[100px] bg-indigo-500 border-indigo-400',
    3: 'w-[140px] bg-indigo-700 border-indigo-600'
  };

  return (
    <div className="space-y-6">
      {/* Game Instruction */}
      <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 text-left space-y-1">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Game 4: Tower of Hanoi
        </h4>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Move all disks from the <strong className="text-slate-200">Left peg</strong> to the <strong className="text-slate-200">Right peg</strong>. 
          Rule: You can only move one disk at a time, and never place a larger disk on top of a smaller one.
        </p>
      </div>

      {/* Visual Hanoi Board */}
      <div className="flex flex-col items-center select-none">
        <div className="w-full max-w-[280px] bg-slate-950/45 p-6 rounded-3xl border border-slate-850 shadow-inner flex flex-col gap-8">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 px-1">
            <span>{selectedPeg !== null ? 'Select destination peg' : 'Tap a peg to pick top disk'}</span>
            <button 
              onClick={handleResetBoard}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-400 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Pegs</span>
            </button>
          </div>

          {/* Peg columns container */}
          <div className="flex justify-around items-end h-40 relative px-2">
            {[0, 1, 2].map((pegIdx) => {
              const diskList = pegs[pegIdx];
              const isSelected = selectedPeg === pegIdx;

              return (
                <div 
                  key={pegIdx}
                  onClick={() => handlePegClick(pegIdx)}
                  className={`
                    relative flex flex-col items-center justify-end h-full w-20 cursor-pointer group
                  `}
                >
                  {/* Vertical Peg Rod */}
                  <div className={`
                    absolute bottom-0 w-2 h-36 rounded-full transition-all duration-300
                    ${isSelected ? 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]' : 'bg-slate-800 group-hover:bg-slate-700'}
                  `} />

                  {/* Disks stacked vertically */}
                  <div className="flex flex-col-reverse items-center gap-1.5 w-full z-10 pb-0.5">
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
                </div>
              );
            })}

            {/* Base Stand Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-900 border-t border-slate-850 rounded-full" />
          </div>
        </div>
      </div>

      {/* Action Button / Alerts */}
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2.5 items-start">
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
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {isSolved && !successMsg && (
          <button
            onClick={submitHanoiSolved}
            disabled={loading}
            style={{ backgroundColor: `rgba(${colorTheme.rgb}, 0.9)` }}
            className="w-full py-4 rounded-2xl text-slate-950 font-bold text-xs tracking-wider uppercase shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] hover:brightness-110"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>Submit Solution</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

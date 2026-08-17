import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, Loader2, Lock, Unlock } from 'lucide-react';

export default function SafeCrackerGame({ teamId, colorTheme, gameData, onSolved, onIncorrect }) {
  const instructions = gameData?.instructions || 'Determine the 4-digit combination to crack the safe.';

  // State to hold the 4 digits
  const [combination, setCombination] = useState([0, 0, 0, 0]);
  const [selectedDigit, setSelectedDigit] = useState(0); // active digit index: 0, 1, 2, 3
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleDigitSelect = (idx) => {
    setSelectedDigit(idx);
    setErrorMsg('');
  };

  const handleNumberInput = (num) => {
    const newCombination = [...combination];
    newCombination[selectedDigit] = num;
    setCombination(newCombination);
    setErrorMsg('');

    // Auto advance to next digit slot
    if (selectedDigit < 3) {
      setSelectedDigit(selectedDigit + 1);
    }
  };

  const checkPuzzleSolved = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Join to a 4-digit string
      const guess = combination.join('');

      // Call database RPC to verify
      const { data, error } = await supabase.rpc('submit_team_answer', {
        p_team_id: teamId,
        p_answer: guess
      });

      if (error) throw error;

      if (data.success) {
        setSuccessMsg('🎉 Code correct! Safe unlocked.');
        setTimeout(() => {
          onSolved();
        }, 1500);
      } else {
        setErrorMsg(data.error || 'Incorrect combination. Penalty count increased (+1)!');
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
      {/* Game instructions */}
      <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 text-left space-y-1">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Game 5: 4-Digit Safe Cracker
        </h4>
        <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
          {instructions}
        </p>
      </div>

      {/* Visual Combination Lock */}
      <div className="flex flex-col items-center select-none">
        <div className="w-full max-w-[280px] bg-slate-950/45 p-6 rounded-3xl border border-slate-850 shadow-inner flex flex-col gap-6 items-center">
          
          {/* Lock Icon */}
          <div className="p-3 rounded-full bg-slate-900 border border-slate-800 shadow-inner">
            {successMsg ? (
              <Unlock className="w-8 h-8 text-emerald-400" />
            ) : (
              <Lock className="w-8 h-8 text-slate-500 animate-pulse" />
            )}
          </div>

          {/* Dials: [ _ ] [ _ ] [ _ ] [ _ ] */}
          <div className="grid grid-cols-4 gap-2 w-full px-2">
            {combination.map((digit, idx) => {
              const isSelected = selectedDigit === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleDigitSelect(idx)}
                  className={`
                    h-14 rounded-xl border text-xl font-black transition-all focus:outline-none flex items-center justify-center
                    ${isSelected 
                      ? 'bg-slate-950 border-2 text-white scale-105 shadow-lg ring-2 ring-indigo-500/20' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                    }
                  `}
                  style={isSelected ? { borderColor: `rgba(${colorTheme.rgb}, 0.8)` } : {}}
                >
                  {digit}
                </button>
              );
            })}
          </div>

          {/* Keypad 0-9 */}
          <div className="w-full space-y-1.5 pt-2 border-t border-slate-900">
            <span className="text-[9px] uppercase font-bold text-slate-500 px-1 block text-left mb-1">
              Keypad Dials
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberInput(num)}
                  style={{ borderColor: `rgba(${colorTheme.rgb}, 0.1)` }}
                  className="py-2.5 rounded-lg border border-slate-900 bg-slate-900 text-slate-300 font-bold text-xs hover:bg-slate-800 hover:text-white transition-all active:scale-90"
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Button & Alerts */}
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2.5 items-start animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Access Denied: </span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2.5 items-start">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Access Granted: </span>
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
            <span>Unlock Safe</span>
          )}
        </button>
      </div>
    </div>
  );
}

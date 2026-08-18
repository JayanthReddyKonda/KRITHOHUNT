import React, { useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  Unlock,
  ScrollText,
} from 'lucide-react';

const LOCAL_SAFE_CLUES = {
  red: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: '(9 × 2) - 14 = ?', answer: '4' },
      { type: 'digit_sum', question: '998', answer: '8' },
      { type: 'riddle', question: 'I am the number of wheels on a bicycle. What digit am I?', answer: '2' },
      { type: 'roman', question: 'VI', answer: '6' },
    ],
  },
  blue: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: '(8 + 5) - 12 = ?', answer: '1' },
      { type: 'digit_sum', question: '349', answer: '7' },
      { type: 'riddle', question: 'I am the number of days in a week. What digit am I?', answer: '7' },
      { type: 'roman', question: 'III', answer: '3' },
    ],
  },
  green: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: '(4 × 2) - 5 = ?', answer: '3' },
      { type: 'digit_sum', question: '699', answer: '6' },
      { type: 'riddle', question: 'I am the only even prime number. What digit am I?', answer: '2' },
      { type: 'roman', question: 'VIII', answer: '8' },
    ],
  },
  yellow: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: '(6 + 4) - 3 = ?', answer: '7' },
      { type: 'digit_sum', question: '334', answer: '1' },
      { type: 'riddle', question: 'I am the number of fingers on one hand. What digit am I?', answer: '5' },
      { type: 'roman', question: 'IX', answer: '9' },
    ],
  },
  purple: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: '(3 × 4) - 4 = ?', answer: '8' },
      { type: 'digit_sum', question: '499', answer: '4' },
      { type: 'riddle', question: 'I am one less than ten. What digit am I?', answer: '9' },
      { type: 'roman', question: 'II', answer: '2' },
    ],
  },
  orange: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: '(9 - 1) - 2 = ?', answer: '6' },
      { type: 'digit_sum', question: '2000', answer: '2' },
      { type: 'riddle', question: 'Add nothing to five and I stay the same. What digit am I?', answer: '0' },
      { type: 'roman', question: 'V', answer: '5' },
    ],
  },
};

export default function SafeCrackerGame({ teamId, colorTheme, gameData, onSolved, onIncorrect, isDemo = false }) {
  const instructions =
    gameData?.instructions ||
    'Solve the clue and enter the exact 4-digit code into the safe lock.';

  const scenarioKey = String(colorTheme?.name || '').toLowerCase();
  const localScenario = LOCAL_SAFE_CLUES[scenarioKey] || LOCAL_SAFE_CLUES.red;
  const clueCards = Array.isArray(gameData?.clues) && gameData.clues.length === 4
    ? gameData.clues
    : [gameData?.clue1, gameData?.clue2, gameData?.clue3, gameData?.clue4].every(Boolean)
      ? [gameData?.clue1, gameData?.clue2, gameData?.clue3, gameData?.clue4]
      : localScenario.clues;
  const completionTitle = gameData?.completion_clue?.title || localScenario.completionTitle;
  const completionMessage = gameData?.completion_clue?.message || localScenario.completionMessage;
  const normalizeDigit = (v) => {
    const s = String(v ?? '').trim();
    if (!/^\d$/.test(s)) return null;
    return s;
  };

  const activeAnswerDigits = clueCards.map((c) => normalizeDigit(c?.answer));

  const submittingRef = useRef(false);

  // combination holds the solved digits (as strings to preserve '0').
  const [combination, setCombination] = useState([null, null, null, null]);
  const [enteredDigit, setEnteredDigit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [clueErrorMsg, setClueErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showFinalClue, setShowFinalClue] = useState(false);

  const comboReady = combination.every((digit) => digit !== null);
  const activeIndex = combination.findIndex((d) => d === null);

  const accentColor = `rgba(${colorTheme.rgb}, 0.9)`;
  const accentBorder = `rgba(${colorTheme.rgb}, 0.25)`;

  const renderClueQuestion = (clue) => {
    const q = clue?.question || 'Missing clue question in game_data.';
    const commonBox =
      'rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3';
    switch (clue?.type) {
      case 'math':
        return (
          <div className={commonBox}>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {q}
            </p>
          </div>
        );
      case 'digit_sum':
        return (
          <div className={commonBox}>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line font-semibold">
              {q}
            </p>
          </div>
        );
      case 'riddle':
        return (
          <div className={commonBox}>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line italic">
              {q}
            </p>
          </div>
        );
      case 'roman':
        return (
          <div className={commonBox}>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              <span className="font-black tracking-wider" style={{ color: accentColor }}>
                {q}
              </span>
            </p>
          </div>
        );
      default:
        return (
          <div className={commonBox}>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {q}
            </p>
          </div>
        );
    }
  };

  const handleNumberInput = (num) => {
    if (comboReady || submittingRef.current || loading || !!successMsg) return;
    setClueErrorMsg('');
    setEnteredDigit(String(num));
  };

  const checkActiveClue = () => {
    if (comboReady || submittingRef.current || loading || !!successMsg) return;
    if (activeIndex < 0) return;

    const expected = activeAnswerDigits[activeIndex];
    if (expected === null) {
      setClueErrorMsg('Clue not configured for this digit.');
      return;
    }
    if (enteredDigit === null) {
      setClueErrorMsg(`Enter a digit for Clue ${activeIndex + 1}.`);
      return;
    }

    if (enteredDigit === expected) {
      setCombination((prev) => {
        const next = [...prev];
        next[activeIndex] = enteredDigit;
        return next;
      });
      setEnteredDigit(null);
      setClueErrorMsg('');
    } else {
      // Per-clue wrong answer: do not unlock, do not advance, do not call RPC.
      setClueErrorMsg('Incorrect digit. Try again.');
      setEnteredDigit(null);
    }
  };

  const checkPuzzleSolved = async () => {
    if (!comboReady) return;
    if (submittingRef.current || successMsg) return;
    submittingRef.current = true;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setShowFinalClue(false);

    try {
      // Safe codes must be treated as strings so leading zeroes are preserved.
      const guess = `${combination[0]}${combination[1]}${combination[2]}${combination[3]}`.trim();

      if (isDemo) {
        const expectedCode = activeAnswerDigits.join('');
        if (guess === expectedCode) {
          setSuccessMsg('SAFE CRACKED! 🔓');
          setShowFinalClue(true);
          setTimeout(() => {
            onSolved();
          }, 3500);
        } else {
          setErrorMsg('Incorrect Safe Code');
          onIncorrect();
          submittingRef.current = false;
        }
        return;
      }

      const { data, error } = await supabase.rpc('submit_team_answer', {
        p_team_id: teamId,
        p_answer: guess,
      });

      if (error) throw error;

      if (data.success) {
        setSuccessMsg('SAFE CRACKED! 🔓');
        setShowFinalClue(true);
        setTimeout(() => {
          onSolved();
        }, 3500);
      } else {
        setErrorMsg('Incorrect Safe Code');
        onIncorrect();
        submittingRef.current = false;
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Connection error. Please try again.');
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-5 px-1 pb-6">
      <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 text-left space-y-1">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Game 5: 4-Digit Safe Cracker
        </h4>
        <p className="text-sm text-slate-300 leading-relaxed">{instructions}</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-slate-400" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Safe Clue Sheet
          </span>
        </div>

        <div className="divide-y divide-slate-800/70">
          {clueCards.map((clue, idx) => {
            const solved = combination[idx] !== null;
            const unlocked = solved || idx === activeIndex;
            const isLocked = !unlocked;

            const labelByIndex = ['Math', 'Digital Root', 'Riddle', 'Roman numeral'][idx] || 'Clue';

            return (
              <div
                key={idx}
                className={`p-4 space-y-2 ${isLocked ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                      style={{ backgroundColor: accentBorder, color: accentColor }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {labelByIndex}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {solved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : unlocked ? (
                      <Unlock className="w-4 h-4 text-indigo-300" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                </div>

                <div className="pl-8">
                  {renderClueQuestion(clue)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-950/50 p-5 rounded-3xl border border-slate-850 shadow-inner space-y-5">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-slate-900 border border-slate-800 shadow-inner">
            {successMsg ? (
              <Unlock className="w-8 h-8 text-emerald-400" />
            ) : (
              <Lock className="w-8 h-8 text-slate-500 animate-pulse" />
            )}
          </div>
        </div>

        <div className="w-full">
          <div className="grid grid-cols-4 gap-2 mb-1.5">
            {['Digit 1', 'Digit 2', 'Digit 3', 'Digit 4'].map((label, idx) => (
              <span
                key={idx}
                className="text-center text-[10px] uppercase tracking-wider font-bold text-slate-600"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {combination.map((digit, idx) => {
              const solved = digit !== null;
              const isActive = !comboReady && idx === activeIndex;
              const shown = solved ? digit : isActive ? (enteredDigit ?? '?') : '?';

              return (
                <div
                  key={idx}
                  className={`h-16 rounded-xl border text-2xl font-black flex items-center justify-center ${
                    isActive
                      ? 'bg-slate-950 border-2 text-white scale-105 shadow-lg'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                  style={isActive ? { borderColor: accentColor } : {}}
                >
                  {shown}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-600 text-center mt-2">
            {comboReady
              ? 'All digits solved. Tap "Unlock Safe" below.'
              : `Solve Clue ${activeIndex + 1} by entering its digit, then pressing Check.`}
          </p>

          {!comboReady && clueErrorMsg && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {clueErrorMsg}
            </div>
          )}
        </div>

        <div className="w-full space-y-2 pt-3 border-t border-slate-900">
          <span className="text-[11px] uppercase font-bold text-slate-500 block text-left">
            Keypad
          </span>
          <div className="grid grid-cols-5 gap-2">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberInput(num)}
                disabled={comboReady || submittingRef.current || loading || !!successMsg}
                style={{ borderColor: `rgba(${colorTheme.rgb}, 0.15)` }}
                className="h-12 rounded-lg border border-slate-900 bg-slate-900 text-slate-300 font-bold text-base active:bg-slate-800 active:text-white transition-all active:scale-95 disabled:opacity-50"
              >
                {num}
              </button>
            ))}
          </div>

          <button
            onClick={checkActiveClue}
            disabled={
              comboReady ||
              submittingRef.current ||
              loading ||
              !!successMsg ||
              enteredDigit === null ||
              activeIndex < 0
            }
            className="w-full h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Check Clue {activeIndex + 1}
          </button>
        </div>
      </div>

      <div className="space-y-3 pb-2">
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-2.5 items-start animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Access Denied: </span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex gap-2.5 items-start">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Access Granted: </span>
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {showFinalClue && (
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-sm space-y-1">
            <div className="font-bold text-indigo-300 uppercase tracking-wider text-xs">
              {completionTitle}
            </div>
            <div>{completionMessage}</div>
          </div>
        )}

        <button
          onClick={checkPuzzleSolved}
          disabled={loading || !!successMsg || !comboReady}
          style={!successMsg && comboReady ? { backgroundColor: accentColor } : {}}
          className={`w-full h-14 rounded-2xl text-slate-950 font-bold text-sm tracking-wider uppercase shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
            successMsg ? 'bg-emerald-500 text-slate-950' : comboReady ? 'active:brightness-110' : 'bg-slate-800 text-slate-500'
          }`}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <span>Unlock Safe</span>
          )}
        </button>
      </div>
    </div>
  );
}

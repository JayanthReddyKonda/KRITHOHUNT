import React, { useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { AlertTriangle, CheckCircle2, Loader2, Lock, Unlock, ScrollText } from 'lucide-react';
import { Button, KeypadButton, SafeDigitDisplay } from '@/components/primitives';

const LOCAL_SAFE_CLUES = {
  red: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: 'Solve for x: 4^(x - 1) = 64. What digit is x?', answer: '4' },
      { type: 'digit_sum', question: 'What is the single-digit digital root of 2987?', answer: '8' },
      { type: 'riddle', question: 'Three digits A < B < C form an arithmetic progression. Given A + B + C = 15 and A × C = 21, what is the largest digit C?', answer: '7' },
      { type: 'roman', question: 'In Roman numerals, what digit does VI represent?', answer: '6' },
    ],
  },
  blue: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: 'Solve for x: 5x - 13 = 2x - 10. What digit is x?', answer: '1' },
      { type: 'digit_sum', question: 'What is the single-digit digital root of 3499?', answer: '7' },
      { type: 'riddle', question: 'Three digits P < Q < R form an arithmetic progression. Given P + Q + R = 18 and P × R = 32, what is the middle digit Q?', answer: '6' },
      { type: 'roman', question: 'In Roman numerals, what digit does III represent?', answer: '3' },
    ],
  },
  green: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: 'Solve for x: 3^(x + 1) = 81. What digit is x?', answer: '3' },
      { type: 'digit_sum', question: 'What is the single-digit digital root of 6873?', answer: '6' },
      { type: 'riddle', question: 'Three digits X < Y < Z form an arithmetic progression. Given X + Y + Z = 18 and X × Z = 32, what is the largest digit Z?', answer: '8' },
      { type: 'roman', question: 'In Roman numerals, what digit does V represent?', answer: '5' },
    ],
  },
  yellow: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: 'Solve for x: 4x - 9 = x + 12. What digit is x?', answer: '7' },
      { type: 'digit_sum', question: 'What is the single-digit digital root of 589?', answer: '4' },
      { type: 'riddle', question: 'Three distinct digits A < B < C satisfy A + B + C = 15 and A × C = 16. If B is the arithmetic mean of A and C, what is the middle digit B?', answer: '5' },
      { type: 'roman', question: 'In Roman numerals, what digit does IX represent?', answer: '9' },
    ],
  },
  purple: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: 'Solve for x: 2^(x - 1) = 128. What digit is x?', answer: '8' },
      { type: 'digit_sum', question: 'What is the single-digit digital root of 787?', answer: '4' },
      { type: 'riddle', question: 'Three digits A < B < C form an arithmetic progression. Given A + B + C = 15 and A × C = 21, what is the largest digit C?', answer: '7' },
      { type: 'roman', question: 'In Roman numerals, what digit does II represent?', answer: '2' },
    ],
  },
  orange: {
    completionTitle: 'FINAL CLUE',
    completionMessage: 'Return to the Start Point where the hunt began. Your next clue is waiting there.',
    clues: [
      { type: 'math', question: 'Solve for x: 6x - 14 = 2x + 10. What digit is x?', answer: '6' },
      { type: 'digit_sum', question: 'What is the single-digit digital root of 2900?', answer: '2' },
      { type: 'riddle', question: 'Three digits X < Y < Z form an arithmetic progression. Given X + Y + Z = 21 and X × Z = 45, what is the largest digit Z?', answer: '9' },
      { type: 'roman', question: 'In Roman numerals, what digit does V represent?', answer: '5' },
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
  const storageKey = `krithohunt_safe_${teamId}`;

  const [combination, setCombination] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      return Array.isArray(saved) && saved.length === 4 ? saved : [null, null, null, null];
    } catch {
      return [null, null, null, null];
    }
  });
  const [enteredDigit, setEnteredDigit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [clueErrorMsg, setClueErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showFinalClue, setShowFinalClue] = useState(false);

  React.useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(combination));
  }, [storageKey, combination]);

  const comboReady = combination.every((digit) => digit !== null);
  const activeIndex = combination.findIndex((d) => d === null);

  const accentColor = `hsl(var(--accent-${colorTheme?.accent || 'brand'}))`;

  const renderClueQuestion = (clue) => {
    const q = clue?.question || 'Missing clue question in game_data.';
    const commonBox = 'rounded-xl border border-border-subtle bg-surface-2 p-3';
    switch (clue?.type) {
      case 'math':
        return (
          <div className={commonBox}>
            <p className="text-body-sm text-secondary leading-relaxed whitespace-pre-line">{q}</p>
          </div>
        );
      case 'digit_sum':
        return (
          <div className={commonBox}>
            <p className="text-body-sm text-secondary leading-relaxed whitespace-pre-line font-semibold">{q}</p>
          </div>
        );
      case 'riddle':
        return (
          <div className={commonBox}>
            <p className="text-body-sm text-secondary leading-relaxed whitespace-pre-line italic">{q}</p>
          </div>
        );
      case 'roman':
        return (
          <div className={commonBox}>
            <p className="text-body-sm text-secondary leading-relaxed whitespace-pre-line">
              <span className="font-semibold tracking-wide" style={{ color: accentColor }}>{q}</span>
            </p>
          </div>
        );
      default:
        return (
          <div className={commonBox}>
            <p className="text-body-sm text-secondary leading-relaxed whitespace-pre-line">{q}</p>
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
      const guess = `${combination[0]}${combination[1]}${combination[2]}${combination[3]}`.trim();

      if (isDemo) {
        const expectedCode = activeAnswerDigits.join('');
        if (guess === expectedCode) {
          setSuccessMsg('SAFE CRACKED! 🔓');
          localStorage.removeItem(storageKey);
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
        localStorage.removeItem(storageKey);
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

  const LABELS = ['Math', 'Digital Root', 'Logic Deduction', 'Roman numeral'];

  return (
    <div className="w-full max-w-md mx-auto space-y-5 px-1 pb-6">
      <div className="bg-surface-2/40 border border-border-subtle/50 rounded-xl p-4 space-y-1">
        <h4 className="text-caption font-semibold text-muted uppercase tracking-wide">Game 5: 4-Digit Safe Cracker</h4>
        <p className="text-body-sm text-secondary leading-relaxed">{instructions}</p>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-2/20 overflow-hidden shadow-inner">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-muted" />
          <span className="text-caption font-semibold uppercase tracking-wide text-muted">Safe Clue Sheet</span>
        </div>

        <div className="divide-y divide-border-subtle/70 bg-surface-1/40">
          {clueCards.map((clue, idx) => {
            const solved = combination[idx] !== null;
            const unlocked = solved || idx === activeIndex;
            const isLocked = !unlocked;

            return (
              <div key={idx} className={`p-4 space-y-2 ${isLocked ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-caption font-semibold shrink-0"
                      style={{ backgroundColor: `hsl(var(--accent-${colorTheme?.accent || 'brand'}) / 0.1)`, color: accentColor }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-caption font-semibold uppercase tracking-wide text-muted">{LABELS[idx] || 'Clue'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {solved ? (
                      <CheckCircle2 className="w-4 h-4 text-feedback-success" />
                    ) : unlocked ? (
                      <Unlock className="w-4 h-4" style={{ color: accentColor }} />
                    ) : (
                      <Lock className="w-4 h-4 text-muted" />
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

      <div className="bg-surface-2/40 border border-border-subtle/50 rounded-xl p-5 space-y-5 shadow-inner">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-surface-2 border border-border-subtle shadow-inner">
            {successMsg ? (
              <Unlock className="w-8 h-8 text-feedback-success" />
            ) : (
              <Lock className="w-8 h-8 text-muted animate-pulse" />
            )}
          </div>
        </div>

        <div className="w-full">
          <div className="grid grid-cols-4 gap-2 mb-1.5">
            {['Digit 1', 'Digit 2', 'Digit 3', 'Digit 4'].map((label, idx) => (
              <span key={idx} className="text-center text-micro uppercase tracking-wide font-semibold text-muted">{label}</span>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {combination.map((digit, idx) => {
              const solved = digit !== null;
              const isActive = !comboReady && idx === activeIndex;
              const shown = solved ? digit : isActive ? (enteredDigit ?? '?') : '?';

              return (
                <SafeDigitDisplay
                  key={idx}
                  digit={shown}
                  state={solved ? 'correct' : isActive ? 'active' : 'empty'}
                  className={isActive ? 'ring-2 ring-offset-2 ring-offset-surface-0 scale-105' : ''}
                  style={isActive ? { borderColor: accentColor, '--tw-ring-color': accentColor } : solved ? { color: 'hsl(var(--feedback-success))', borderColor: 'hsl(var(--feedback-success) / 0.5)' } : {}}
                />
              );
            })}
          </div>

          <p className="text-caption text-muted text-center mt-2">
            {comboReady ? 'All digits solved. Tap "Unlock Safe" below.' : `Solve Clue ${activeIndex + 1} by entering its digit, then pressing Check.`}
          </p>

          {!comboReady && clueErrorMsg && (
            <div className="mt-3 p-3 rounded-xl bg-feedback-error/10 border border-feedback-error/20 text-feedback-error text-body-sm" role="alert">{clueErrorMsg}</div>
          )}
        </div>

        <div className="w-full space-y-2 pt-3 border-t border-border-subtle/40">
          <span className="text-caption font-semibold text-muted uppercase tracking-wide block text-left">Keypad</span>
          <div className="grid grid-cols-5 gap-2" role="group" aria-label="Safe keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
              <KeypadButton
                key={num}
                value={num}
                onClick={() => handleNumberInput(num)}
                disabled={comboReady || submittingRef.current || loading || !!successMsg}
                className="min-h-[48px] min-w-[48px] text-body"
                aria-label={`Enter digit ${num}`}
                style={!comboReady && activeIndex >= 0 ? { borderColor: accentColor } : {}}
              />
            ))}
          </div>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={checkActiveClue}
            disabled={comboReady || submittingRef.current || loading || !!successMsg || enteredDigit === null || activeIndex < 0}
            className="touch-target"
          >
            Check Clue {activeIndex + 1}
          </Button>
        </div>
      </div>

      <div className="space-y-3 pb-2 animate-in">
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-feedback-error/10 border border-feedback-error/20 text-feedback-error text-body-sm flex gap-2.5 items-start animate-shake" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Access denied: </span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-feedback-success/15 border border-feedback-success/20 text-feedback-success text-body-sm flex gap-2.5 items-start" role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Access granted: </span>
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {showFinalClue && (
          <div
            className="p-4 rounded-xl space-y-1 border"
            style={{
              backgroundColor: `hsl(var(--accent-${colorTheme?.accent || 'brand'}) / 0.15)`,
              borderColor: `hsl(var(--accent-${colorTheme?.accent || 'brand'}) / 0.3)`,
              color: accentColor
            }}
          >
            <div className="font-semibold uppercase tracking-wide text-caption">{completionTitle}</div>
            <div className="text-body-sm">{completionMessage}</div>
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={checkPuzzleSolved}
          disabled={loading || !!successMsg || !comboReady}
          loading={loading}
          className="touch-target"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Unlocking...</span>
            </>
          ) : (
            <span>Unlock Safe</span>
          )}
        </Button>
      </div>
    </div>
  );
}
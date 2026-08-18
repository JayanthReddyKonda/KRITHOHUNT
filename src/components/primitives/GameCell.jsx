import React from 'react';

export default function GameCell({
  children,
  variant = 'default', // 'default' | 'fixed' | 'selected' | 'filled' | 'correct' | 'error'
  onClick,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
  ...props
}) {
  const variantClasses = {
    default: 'bg-surface-2 border-border-subtle text-primary',
    fixed: 'bg-surface-1 border-border-subtle text-primary cursor-not-allowed',
    selected: 'bg-surface-2 border-2 border-accent-indigo shadow-[0_0_0_3px_hsl(var(--accent-indigo)_/_0.2)] text-primary transform scale-105',
    filled: 'bg-surface-3 border-border-strong text-accent-indigo',
    correct: 'bg-feedback-success/20 border-feedback-success text-feedback-success',
    error: 'bg-feedback-error/20 border-feedback-error text-feedback-error animate-shake',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className={`
        game-cell
        touch-target
        rounded-lg
        font-bold
        transition-all duration-fast ease-standard
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0
        ${variantClasses[variant]}
        ${disabled && variant !== 'fixed' ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}

// Convenience components for specific game cell types
export function SudokuCell({ value, isFixed, isSelected, onClick, ...props }) {
  if (isFixed) {
    return <GameCell variant="fixed" disabled onClick={onClick} {...props}>{value}</GameCell>;
  }
  if (isSelected) {
    return <GameCell variant="selected" onClick={onClick} {...props}>{value || ''}</GameCell>;
  }
  if (value) {
    return <GameCell variant="filled" onClick={onClick} {...props}>{value}</GameCell>;
  }
  return <GameCell variant="default" onClick={onClick} {...props}>{value || ''}</GameCell>;
}

export function KeypadButton({ value, onClick, disabled, active, ...props }) {
  return (
    <GameCell
      variant={active ? 'selected' : 'default'}
      onClick={onClick}
      disabled={disabled}
      className={`text-body ${active ? 'ring-2 ring-accent-indigo ring-offset-2 ring-offset-surface-0' : ''}`}
      {...props}
    >
      {value}
    </GameCell>
  );
}

export function SafeDigitDisplay({ digit, state, ...props }) {
  // state: 'empty' | 'active' | 'filled' | 'correct'
  const variantMap = {
    empty: 'default',
    active: 'selected',
    filled: 'filled',
    correct: 'correct',
  };
  return (
    <GameCell
      variant={variantMap[state] || 'default'}
      disabled
      className="text-2xl font-black"
      {...props}
    >
      {digit ?? '?'}
    </GameCell>
  );
}
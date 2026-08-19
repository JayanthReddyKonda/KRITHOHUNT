import React from 'react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  className = '',
  'aria-label': ariaLabel,
  type = 'button',
  ...props
}) {
  const baseClasses = `
    inline-flex items-center justify-center gap-1.5
    font-semibold select-none
    rounded-xl transition-all duration-fast cubic-bezier(0.16, 1, 0.3, 1)
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0
    disabled:opacity-40 disabled:cursor-not-allowed
    active:scale-[0.97] active:brightness-95
  `;

  const variantClasses = {
    primary: 'bg-accent-brand text-inverse shadow-sm hover:brightness-105 active:shadow-inner',
    secondary: 'bg-surface-2 text-primary border border-border-subtle hover:bg-surface-3 hover:border-border-strong active:bg-surface-3',
    ghost: 'bg-transparent text-secondary hover:bg-surface-2 hover:text-primary active:bg-surface-3',
    danger: 'bg-feedback-error text-inverse shadow-sm hover:brightness-105 active:shadow-inner',
    success: 'bg-feedback-success text-inverse shadow-sm hover:brightness-105 active:shadow-inner',
    accent: 'bg-accent-brand text-inverse shadow-sm hover:brightness-105 active:shadow-inner',
  };

  const sizeClasses = {
    sm: 'min-h-[34px] px-2.5 text-[0.6875rem]',
    md: 'min-h-[38px] px-3.5 text-[0.75rem]',
    lg: 'min-h-[42px] px-4 text-[0.75rem] font-bold',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-3.5 w-3.5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        children
      )}
    </button>
  );
}
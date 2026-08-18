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
    inline-flex items-center justify-center gap-2
    font-bold tracking-wider uppercase
    rounded-lg transition-all duration-fast ease-standard
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-[0.98]
  `;

  const variantClasses = {
    primary: 'bg-accent-brand text-inverse hover:brightness-110',
    secondary: 'bg-surface-2 text-primary border border-border-subtle hover:bg-surface-3',
    ghost: 'bg-transparent text-secondary hover:bg-surface-2 hover:text-primary',
    danger: 'bg-feedback-error text-primary hover:brightness-110',
    success: 'bg-feedback-success text-primary hover:brightness-110',
    accent: 'bg-accent-brand text-inverse hover:brightness-110',
  };

  const sizeClasses = {
    sm: 'min-h-[40px] min-w-[40px] px-3 text-caption',
    md: 'min-h-[48px] min-w-[48px] px-5 text-button',
    lg: 'min-h-[56px] min-w-[56px] px-6 text-body',
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
          className="animate-spin h-4 w-4"
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
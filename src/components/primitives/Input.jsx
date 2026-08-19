import React from 'react';

export default function Input({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`input ${error ? 'input-error' : ''} ${className}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className="helper-text helper-error mt-2 flex items-center gap-1.5" role="alert">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </p>
      )}
      {helperText && !error && (
        <p id={helperId} className="helper-text mt-2">{helperText}</p>
      )}
    </div>
  );
}
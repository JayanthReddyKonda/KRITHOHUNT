import React from 'react';

export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) {
  const variantClasses = {
    default: 'bg-surface-1 border border-border-subtle shadow-sm',
    elevated: 'bg-surface-1 border border-border-subtle shadow-sm',
    glass: 'bg-surface-0/90 backdrop-blur-md border border-border-subtle/50 shadow-sm',
    panel: 'bg-surface-2 border border-border-subtle/50 shadow-sm',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-3.5 sm:p-5',
    lg: 'p-4 sm:p-6',
    xl: 'p-5 sm:p-8',
  };

  return (
    <div
      className={`${variantClasses[variant]} rounded-xl ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
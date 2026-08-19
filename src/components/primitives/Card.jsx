import React from 'react';

export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) {
  const variantClasses = {
    default: 'bg-surface-1/90 backdrop-blur-md border border-border-subtle',
    elevated: 'bg-surface-1/90 backdrop-blur-md border border-border-subtle shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
    glass: 'bg-surface-1/80 backdrop-blur-lg border border-border-subtle/50',
    panel: 'bg-surface-2/60 border border-border-subtle',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
    xl: 'p-8',
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
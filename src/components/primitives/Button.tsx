import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'subtle';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-1.5 font-sans font-medium rounded-xs border transition-colors cursor-pointer disabled:cursor-not-allowed select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink';

  const sizeStyles = {
    sm: 'px-2 py-1 text-xs leading-4',
    md: 'px-3 py-1.5 text-xs leading-5',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-ink text-surface border-ink hover:bg-ink-secondary active:bg-ink disabled:bg-muted-border disabled:border-muted-border disabled:text-ink-tertiary',
    secondary:
      'bg-surface text-ink border-strong-border hover:bg-subtle active:bg-paper disabled:bg-subtle disabled:border-muted-border disabled:text-ink-tertiary',
    destructive:
      'bg-conflict text-surface border-conflict hover:bg-invalidated active:bg-conflict disabled:bg-muted-border disabled:border-muted-border disabled:text-ink-tertiary',
    subtle:
      'bg-transparent text-ink-secondary border-transparent hover:bg-subtle hover:text-ink disabled:text-ink-tertiary disabled:bg-transparent',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

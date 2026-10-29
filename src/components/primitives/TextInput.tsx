import React from 'react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  id,
  className = '',
  disabled,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-sans font-medium text-ink-secondary select-none"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        disabled={disabled}
        className={`px-2.5 py-1.5 text-xs font-sans bg-surface text-ink border rounded-xs placeholder:text-ink-tertiary transition-colors disabled:bg-subtle disabled:text-ink-tertiary disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink ${
          error ? 'border-conflict focus-visible:outline-conflict' : 'border-strong-border'
        } ${className}`}
        {...props}
      />
      {error && (
        <span className="text-xs font-sans text-conflict">{error}</span>
      )}
    </div>
  );
};

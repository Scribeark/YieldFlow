import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', fullWidth = true, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`input ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

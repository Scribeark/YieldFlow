import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    
    let variantClass = '';
    switch (variant) {
      case 'primary': variantClass = 'btn-primary'; break;
      case 'secondary': variantClass = 'btn-secondary'; break;
      case 'accent': variantClass = 'btn-accent'; break;
      case 'danger': variantClass = 'btn-danger'; break;
      case 'ghost': variantClass = 'bg-transparent text-current hover:bg-black/5 dark:hover:bg-white/5 border-none shadow-none'; break;
    }

    let sizeClass = '';
    switch (size) {
      case 'sm': sizeClass = 'btn-sm'; break;
      case 'lg': sizeClass = 'btn-lg'; break;
    }

    return (
      <button
        ref={ref}
        className={`btn ${variantClass} ${sizeClass} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? 'Loading...' : children}
      </button>
    );
  }
);
Button.displayName = 'Button';

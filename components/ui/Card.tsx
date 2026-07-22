import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  glass?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', elevated, glass, children, ...props }, ref) => {
    
    let baseClass = 'card';
    if (elevated) baseClass = 'card-elevated';
    if (glass) baseClass = 'glass';

    return (
      <div
        ref={ref}
        className={`${baseClass} p-6 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

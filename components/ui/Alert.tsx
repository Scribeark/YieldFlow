import React from 'react';

type AlertVariant = 'error' | 'success' | 'info';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className = '', variant = 'error', children, ...props }, ref) => {
    
    let colorStyle = {};
    if (variant === 'error') {
      colorStyle = {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        border: '1px solid rgba(239,68,68,0.2)'
      };
    } else if (variant === 'success') {
      colorStyle = {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        color: '#22c55e',
        border: '1px solid rgba(34,197,94,0.2)'
      };
    } else if (variant === 'info') {
      colorStyle = {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        color: '#3b82f6',
        border: '1px solid rgba(59,130,246,0.2)'
      };
    }

    return (
      <div
        ref={ref}
        className={`p-3 rounded text-sm ${className}`}
        style={colorStyle}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Alert.displayName = 'Alert';

import React from 'react';
import { Card } from './Card';

export interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value?: string | number;
  description?: string;
  icon?: React.ReactNode;
}

export const DashboardCard = React.forwardRef<HTMLDivElement, DashboardCardProps>(
  ({ className = '', title, value, description, icon, children, ...props }, ref) => {
    return (
      <Card ref={ref} className={`flex flex-col gap-2 ${className}`} {...props}>
        <div className="flex justify-between items-start">
          <h3 className="text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>{title}</h3>
          {icon && <div style={{ color: 'var(--foreground-dim)' }}>{icon}</div>}
        </div>
        {value !== undefined && (
          <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            {value}
          </div>
        )}
        {description && (
          <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
      </Card>
    );
  }
);
DashboardCard.displayName = 'DashboardCard';

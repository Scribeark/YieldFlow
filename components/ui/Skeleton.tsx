import React from 'react';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`skeleton ${className}`}
        {...props}
      />
    );
  }
);
Skeleton.displayName = 'Skeleton';

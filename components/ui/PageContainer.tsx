import React from 'react';

export type PageContainerProps = React.HTMLAttributes<HTMLDivElement>;

export const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PageContainer.displayName = 'PageContainer';

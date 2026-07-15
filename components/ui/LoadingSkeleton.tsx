export default function LoadingSkeleton({
  rows = 3,
  className = '',
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-6">
      <div className="skeleton mb-4 h-5 w-1/3 rounded" />
      <div className="space-y-3">
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-border bg-background-secondary px-6 py-3">
        <div className="flex gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-3 w-20 rounded" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-8 border-b border-border px-6 py-4">
          {[1, 2, 3, 4].map((j) => (
            <div key={j} className="skeleton h-4 w-24 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="skeleton mb-3 h-3 w-24 rounded" />
      <div className="skeleton mb-2 h-8 w-16 rounded" />
      <div className="skeleton h-3 w-32 rounded" />
    </div>
  );
}

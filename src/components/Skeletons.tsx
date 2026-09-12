export function ListSkeleton({ rows = 4, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="panel flex items-center gap-4 p-4">
          <div className="skeleton size-14 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-4 w-1/3 rounded-md" />
            <div className="skeleton h-3 w-2/3 rounded-md" />
          </div>
          <div className="skeleton h-6 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function TimelineSkeleton({
  steps = 4,
  label = "Loading…",
}: {
  steps?: number;
  label?: string;
}) {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: steps }, (_, i) => (
        <div key={i} className="flex gap-3.5">
          <div className="skeleton size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="skeleton h-4 w-1/3 rounded-md" />
            <div className="skeleton h-3 w-2/3 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsBarSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading summary…</span>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="panel flex items-center gap-3 p-4">
          <div className="skeleton size-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-4 w-8 rounded-md" />
            <div className="skeleton h-3 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

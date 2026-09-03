// Shared skeleton primitives used by loading states across pages.
// Uses the existing slate-200 / slate-100 palette with a soft shimmer.

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`animate-pulse rounded-md bg-slate-200 ${className}`}
    />
  )
}

// Product card skeleton — mirrors the grid ProductCard layout (image + 2 lines + price + button)
export function ProductCardSkeleton({ view = 'grid' as 'grid' | 'list' }: { view?: 'grid' | 'list' }) {
  if (view === 'list') {
    return (
      <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:gap-6 sm:p-5">
        <Skeleton className="h-28 w-28 flex-shrink-0 rounded-xl sm:h-32 sm:w-32" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <div className="mt-auto flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  )
}

// Order card skeleton — header (id + status), summary line, item thumbnails, total
export function OrderCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-3 w-40" />
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-lg" />
        <Skeleton className="h-14 w-14 rounded-lg" />
        <Skeleton className="h-14 w-14 rounded-lg" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-28" />
      </div>
    </div>
  )
}

// Dashboard / admin row skeleton — for table-like layouts
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="grid items-center gap-3 border-b border-slate-100 px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  )
}

// Stats / KPI tile skeleton — large number + small label
export function StatTileSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-7 w-20" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  )
}
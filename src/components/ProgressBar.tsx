export function ProgressBar({ done, total, small = false }: { done: number; total: number; small?: boolean }) {
  const pct = total ? (done / total) * 100 : 0
  return (
    <div className="flex items-center gap-2.5">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className={`flex-1 overflow-hidden rounded-full bg-line ${small ? 'h-1.5' : 'h-2'}`}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-250 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-bold whitespace-nowrap text-accent tabular-nums ${small ? 'text-xs' : 'text-[0.82rem]'}`}>
        {done}/{total}
      </span>
    </div>
  )
}

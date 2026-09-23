export function ProgressBar({ done, total, small = false }: { done: number; total: number; small?: boolean }) {
  const pct = total ? (done / total) * 100 : 0
  const complete = total > 0 && done === total
  return (
    <div className="flex items-center gap-2.5">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Progresso"
        className={`flex-1 overflow-hidden rounded-full bg-line ${small ? "h-1.5" : "h-2"}`}
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-250 ease-out ${complete ? "bg-done" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`font-bold whitespace-nowrap tabular-nums ${complete ? "text-done" : "text-accent"} ${small ? "text-xs" : "text-[0.82rem]"}`}
      >
        {done}/{total}
      </span>
    </div>
  )
}

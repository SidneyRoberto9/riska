import { useId } from "react"
import { tint } from "#/lib/status"
import type { Status } from "#/lib/types"

export function ColumnChips({
  statuses,
  value,
  onChange,
}: {
  statuses: Status[]
  value: string | undefined
  onChange: (status: Status) => void
}) {
  const name = useId()
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0">
      <legend className="sr-only">Coluna</legend>
      {statuses.map((s) => {
        const on = s.id === value
        return (
          <label key={s.id} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={s.id}
              checked={on}
              onChange={() => onChange(s)}
              className="peer sr-only"
            />
            <span
              style={on ? tint(s.color) : undefined}
              className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[0.8rem] font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${on ? "border-transparent" : "border-line text-ink-soft hover:border-ink-soft"}`}
            >
              <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}

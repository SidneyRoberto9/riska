import { Check, Plus } from "lucide-react"
import { type ComponentProps, type FormEvent, type ReactNode, useState } from "react"
import { useActions } from "#/data/actions"
import { statusOf } from "#/lib/status"
import { LIMITS, STATUS_COLORS, type Status, type Task } from "#/lib/types"
import { Popover, type TriggerProps } from "./Popover"

const COLOR_NAMES = ["Vermelho", "Laranja", "Âmbar", "Verde", "Azul", "Roxo", "Rosa", "Cinza"]

// Tinted from the status colour against the current surface/ink, so it works in light and dark
export const tint = (color: string) => ({
  background: `color-mix(in oklab, ${color} 16%, var(--surface))`,
  color: `color-mix(in oklab, ${color} 80%, var(--ink))`,
})

export type StatusDraft = Pick<Status, "name" | "color" | "done">

export function StatusChip({ status, className = "", ...props }: { status: Status } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      style={tint(status.color)}
      className={`inline-block rounded-md px-1.5 py-px align-[1px] text-[0.68rem] font-bold tracking-[.03em] ${className}`}
    >
      {status.name}
    </button>
  )
}

export function StatusEditor({
  initial,
  onSave,
  onRemove,
}: {
  initial?: StatusDraft
  onSave: (v: StatusDraft) => void
  onRemove?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [color, setColor] = useState(initial?.color ?? STATUS_COLORS[0])
  const [done, setDone] = useState(initial?.done ?? false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (n) {
      onSave({ name: n, color, done })
    }
  }
  const custom = !STATUS_COLORS.includes(color)

  return (
    <form onSubmit={submit} className="w-64 space-y-3 p-3">
      <input
        // biome-ignore lint/a11y/noAutofocus: rendered only right after the user asks to type here (opened editor / PIN screen)
        autoFocus
        value={name}
        maxLength={LIMITS.statusName}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: Revisão…"
        aria-label="Nome do status"
        autoComplete="off"
        className="w-full rounded-lg border border-line bg-ground px-3 py-2 focus-visible:border-accent focus-visible:outline-offset-0"
      />
      <div className="flex flex-wrap gap-2">
        {STATUS_COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            title={COLOR_NAMES[i]}
            aria-label={COLOR_NAMES[i]}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className="grid size-8 place-items-center rounded-full text-white ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
            style={{ background: c }}
          >
            {color === c && <Check size={15} strokeWidth={3} aria-hidden />}
          </button>
        ))}
        <label
          title="Cor personalizada"
          className={`relative size-8 cursor-pointer overflow-hidden rounded-full ring-offset-2 ring-offset-surface has-focus-visible:outline-2 has-focus-visible:outline-accent ${custom ? "ring-2 ring-ink" : ""}`}
          style={{ background: custom ? color : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
        >
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Cor personalizada"
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
      <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" className="check" checked={done} onChange={(e) => setDone(e.target.checked)} />
        Conta como concluída
      </label>
      <div className="flex items-center justify-between gap-2">
        <span style={tint(color)} className="rounded-md px-1.5 py-px text-[0.68rem] font-bold tracking-[.03em]">
          {name.trim() || "prévia"}
        </span>
        <div className="flex gap-2">
          {onRemove && (
            <button type="button" onClick={onRemove} className="min-h-10 rounded-lg px-3 text-warn hover:bg-warn-soft">
              Remover
            </button>
          )}
          <button
            type="submit"
            disabled={!name.trim()}
            className="min-h-10 rounded-lg bg-accent px-3.5 font-semibold text-surface disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
      </div>
    </form>
  )
}

// The page's statuses as a single-choice list, plus "Novo status" (creates it and moves the task there)
export function StatusOptions({ task, statuses, onDone }: { task: Task; statuses: Status[]; onDone: () => void }) {
  const a = useActions()
  const [creating, setCreating] = useState(false)
  const current = statusOf(task, statuses)

  if (creating) {
    return (
      <StatusEditor
        onSave={(v) => {
          const id = a.addStatus(task.pageId, v)
          a.setTaskStatus(task, { ...v, id, pageId: task.pageId, position: 0 })
          onDone()
        }}
      />
    )
  }
  return (
    <fieldset aria-label="Status da tarefa" className="min-w-0">
      {statuses.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={s.id === current?.id}
          onClick={() => {
            if (s.id !== current?.id) {
              a.setTaskStatus(task, s)
            }
            onDone()
          }}
          className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left hover:bg-accent-soft"
        >
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
          <span className="flex-1">{s.name}</span>
          {s.id === current?.id && <Check size={16} aria-hidden className="text-accent" />}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-ink-soft hover:bg-accent-soft hover:text-accent"
      >
        <Plus size={16} aria-hidden />
        Novo status
      </button>
    </fieldset>
  )
}

export function StatusPicker({
  task,
  statuses,
  trigger,
}: {
  task: Task
  statuses: Status[]
  trigger: (p: TriggerProps) => ReactNode
}) {
  return (
    <Popover className="min-w-52 p-1" trigger={trigger}>
      {(close) => <StatusOptions task={task} statuses={statuses} onDone={close} />}
    </Popover>
  )
}

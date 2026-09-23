import { useState, type ComponentProps, type FormEvent } from 'react'
import { BADGE_COLORS, LIMITS, type Badge } from '#/lib/types'

// Tinted from the badge colour against the current surface/ink, so it works in light and dark
const tint = (color: string) => ({
  background: `color-mix(in oklab, ${color} 16%, var(--surface))`,
  color: `color-mix(in oklab, ${color} 80%, var(--ink))`,
})

export function BadgeChip({ badge, className = '', ...props }: { badge: Badge } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      style={tint(badge.color)}
      className={`inline-block rounded-md px-1.5 py-px align-[1px] text-[0.68rem] font-bold tracking-[.03em] ${className}`}
    >
      {badge.text}
    </button>
  )
}

export function BadgeEditor({
  initial,
  onSave,
  onRemove,
}: {
  initial?: Badge
  onSave: (badge: Badge) => void
  onRemove?: () => void
}) {
  const [text, setText] = useState(initial?.text ?? '')
  const [color, setColor] = useState(initial?.color ?? BADGE_COLORS[0])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    if (t) onSave({ text: t, color })
  }
  const custom = !BADGE_COLORS.includes(color)

  return (
    <form onSubmit={submit} className="w-64 space-y-3 p-3">
      <input
        autoFocus
        value={text}
        maxLength={LIMITS.badgeText}
        onChange={(e) => setText(e.target.value)}
        placeholder="Texto do badge"
        className="w-full rounded-lg border border-line bg-ground px-3 py-2 outline-none focus:border-accent"
      />
      <div className="flex flex-wrap gap-2">
        {BADGE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Cor ${c}`}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className="size-7 rounded-full ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
            style={{ background: c }}
          />
        ))}
        <label
          title="Cor personalizada"
          className={`relative size-7 cursor-pointer overflow-hidden rounded-full ring-offset-2 ring-offset-surface ${custom ? 'ring-2 ring-ink' : ''}`}
          style={{ background: custom ? color : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
        >
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span style={tint(color)} className="rounded-md px-1.5 py-px text-[0.68rem] font-bold tracking-[.03em]">
          {text.trim() || 'prévia'}
        </span>
        <div className="flex gap-2">
          {onRemove && (
            <button type="button" onClick={onRemove} className="rounded-lg px-3 py-1.5 text-warn hover:bg-warn-soft">
              Remover
            </button>
          )}
          <button disabled={!text.trim()} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-surface disabled:opacity-40">
            Salvar
          </button>
        </div>
      </div>
    </form>
  )
}

import { Ellipsis, type LucideIcon } from "lucide-react"
import { type ReactNode, type RefObject, useId, useLayoutEffect, useRef, useState } from "react"

export type TriggerProps = {
  ref: RefObject<HTMLButtonElement | null>
  popoverTarget: string
  type: "button"
  "aria-expanded": boolean
}

// Native popover API (top layer + light dismiss); positioned next to the trigger by hand
// ponytail: fixed position is computed on open only; switch to CSS anchor positioning once Firefox ships it
export function Popover({
  trigger,
  children,
  className = "",
  onClose,
}: {
  trigger: (props: TriggerProps) => ReactNode
  children: (close: () => void) => ReactNode
  className?: string
  onClose?: () => void
}) {
  const id = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    const b = btn.current
    const p = pop.current
    if (!open || !b || !p) {
      return
    }
    const place = () => {
      const r = b.getBoundingClientRect()
      const left = Math.max(8, Math.min(r.right - p.offsetWidth, innerWidth - p.offsetWidth - 8))
      const below = r.bottom + 4
      const top = below + p.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - p.offsetHeight - 4) : below
      p.style.left = `${left}px`
      p.style.top = `${top}px`
    }
    place()
    // Content can change while open (menu → badge editor), so re-place on resize
    const ro = new ResizeObserver(place)
    ro.observe(p)
    return () => ro.disconnect()
  }, [open])

  return (
    <>
      {trigger({ ref: btn, popoverTarget: id, type: "button", "aria-expanded": open })}
      <div
        ref={pop}
        id={id}
        popover="auto"
        className={`fixed max-w-[calc(100vw-16px)] text-sm ${className}`}
        onToggle={(e) => {
          const isOpen = e.newState === "open"
          setOpen(isOpen)
          if (!isOpen) {
            onClose?.()
          }
        }}
      >
        {open && children(() => pop.current?.hidePopover())}
      </div>
    </>
  )
}

export function Menu({
  label,
  children,
  onClose,
  quiet = false,
}: {
  label: string
  children: (close: () => void) => ReactNode
  onClose?: () => void
  /** Dim until the enclosing `.group` is hovered (pointer devices only) */
  quiet?: boolean
}) {
  return (
    <Popover
      className="min-w-48 p-1"
      onClose={onClose}
      trigger={(p) => (
        <button
          {...p}
          aria-label={label}
          className={`-my-1.5 grid size-10 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-accent ${quiet ? "row-action" : ""}`}
        >
          <Ellipsis size={18} aria-hidden />
        </button>
      )}
    >
      {children}
    </Popover>
  )
}

export function MenuItem({
  onClick,
  children,
  icon: Icon,
  danger,
  disabled,
}: {
  onClick: () => void
  children: ReactNode
  icon: LucideIcon
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left hover:bg-accent-soft disabled:pointer-events-none disabled:opacity-40 ${danger ? "text-warn hover:bg-warn-soft" : ""}`}
    >
      <Icon size={16} aria-hidden className={danger ? "" : "text-ink-soft"} />
      {children}
    </button>
  )
}

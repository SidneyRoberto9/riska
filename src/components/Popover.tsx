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

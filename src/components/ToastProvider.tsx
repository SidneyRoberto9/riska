import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react"
import { createPortal } from "react-dom"

type ToastAction = { label: string; onClick: () => void }
type ToastItem = { id: number; text: string; action?: ToastAction }
type Show = (text: string, action?: ToastAction) => void

const ToastContext = createContext<Show>(() => {})
export const useToast = () => useContext(ToastContext)

let seq = 0

// A modal <dialog> makes everything outside it inert (a top-layer popover too), so toasts render inside the
// last open modal dialog — otherwise "Desfazer" can't be clicked or focused while one is open
function useModalHost() {
  const [host, setHost] = useState<Element | null>(null)
  useEffect(() => {
    const update = () => setHost(Array.from(document.querySelectorAll("dialog:modal")).at(-1) ?? null)
    const observer = new MutationObserver(update)
    observer.observe(document.body, { subtree: true, childList: true, attributeFilter: ["open"] })
    update()
    return () => observer.disconnect()
  }, [])
  return host
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const host = useModalHost()
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const show = useCallback<Show>(
    (text, action) => {
      const id = ++seq
      setToasts((t) => [...t.slice(-2), { id, text, action }])
      setTimeout(() => dismiss(id), 6000)
    },
    [dismiss]
  )

  const list = toasts.map((t) => (
    <div
      key={t.id}
      className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-ground shadow-lg"
    >
      <span>{t.text}</span>
      {t.action && (
        <button
          className="-my-1 min-h-9 rounded-md px-2 font-semibold underline underline-offset-2"
          onClick={() => {
            dismiss(t.id)
            t.action?.onClick()
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  ))
  // Each region stays mounted while its host exists, so a live region is never inserted already holding text
  const region = (items: ReactNode) => (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4"
    >
      {items}
    </div>
  )

  return (
    <ToastContext.Provider value={show}>
      {children}
      {region(host ? null : list)}
      {host && createPortal(region(list), host)}
    </ToastContext.Provider>
  )
}

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastItem = { id: number; text: string; retry?: () => void }
type Show = (text: string, retry?: () => void) => void

const ToastContext = createContext<Show>(() => {})
export const useToast = () => useContext(ToastContext)

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const show = useCallback<Show>(
    (text, retry) => {
      const id = ++seq
      setToasts((t) => [...t.slice(-2), { id, text, retry }])
      setTimeout(() => dismiss(id), 6000)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-ground shadow-lg">
            <span>{t.text}</span>
            {t.retry && (
              <button
                className="font-semibold underline underline-offset-2"
                onClick={() => {
                  dismiss(t.id)
                  t.retry?.()
                }}
              >
                Tentar de novo
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

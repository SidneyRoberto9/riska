import { useEffect } from "react"

// Keeps Esc from closing a modal <dialog> while `on`. `cancel` alone isn't enough: Chromium's CloseWatcher skips it
// on a second Esc without user activation. Listens on the document because focus may sit on <body> (e.g. after the
// focused button became disabled), outside the dialog.
export function useBlockEscape(on: boolean) {
  useEffect(() => {
    if (!on) {
      return
    }
    const block = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
      }
    }
    document.addEventListener("keydown", block, true)
    return () => document.removeEventListener("keydown", block, true)
  }, [on])
}

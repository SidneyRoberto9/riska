import { useSearch } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useApplyTheme } from "#/data/theme"

export function Shell({ children }: { children: ReactNode }) {
  useApplyTheme()
  // One width for the whole app; the board sizes its columns to the viewport height, so it skips the bottom padding
  const { view } = useSearch({ strict: false }) as { view?: string }
  return <div className={`mx-auto max-w-[1440px] px-4 sm:px-6 ${view === "quadro" ? "" : "pb-12"}`}>{children}</div>
}

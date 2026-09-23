import { useSearch } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useApplyTheme } from "#/data/theme"

export function Shell({ children }: { children: ReactNode }) {
  useApplyTheme()
  // One width for the whole app; the board sizes its columns to the viewport height, so it skips the bottom padding
  const { view } = useSearch({ strict: false }) as { view?: string }
  return <div className={`mx-auto max-w-[1440px] px-4 sm:px-6 ${view === "quadro" ? "" : "pb-12"}`}>{children}</div>
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-24 text-center sm:px-6">
      <h1 className="text-2xl font-extrabold">Não encontrado</h1>
      <a href="/" className="mt-4 inline-block text-accent underline">
        Voltar ao início
      </a>
    </div>
  )
}

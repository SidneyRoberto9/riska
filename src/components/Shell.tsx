import type { ReactNode } from 'react'
import { useApplyTheme } from '#/data/theme'

export function Shell({ children }: { children: ReactNode }) {
  useApplyTheme()
  return <div className="mx-auto max-w-[720px] px-4 pb-12">{children}</div>
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-[720px] px-4 pt-24 text-center">
      <h1 className="text-2xl font-extrabold">Não encontrado</h1>
      <a href="/" className="mt-4 inline-block text-accent underline">
        Voltar ao início
      </a>
    </div>
  )
}

import { useSearch } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useApplyTheme } from '#/data/theme'

export function Shell({ children }: { children: ReactNode }) {
  useApplyTheme()
  // The board uses the whole window; everything else keeps the reading width
  const { view } = useSearch({ strict: false }) as { view?: string }
  return <div className={`mx-auto px-4 pb-12 ${view === 'quadro' ? 'max-w-none sm:px-6' : 'max-w-[720px]'}`}>{children}</div>
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

import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { CreateSession } from "#/components/CreateSession"
import { EnterSession } from "#/components/EnterSession"
import { card } from "#/components/sessionForm"
import { readRecent } from "#/data/recent"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  const [recent, setRecent] = useState<string[]>([])
  useEffect(() => setRecent(readRecent()), [])

  return (
    <div className="mx-auto max-w-[1440px] space-y-3.5 px-4 pt-10 pb-12 sm:px-6">
      <header className="mb-6">
        <h1 className="m-0 text-3xl font-extrabold tracking-[-0.01em]">Checklist</h1>
        <p className="m-0 mt-1 text-ink-soft">Listas simples, sincronizadas entre celular e PC.</p>
      </header>

      {recent.length > 0 && (
        <section className={card}>
          <h2 className="m-0 mb-3 text-base font-bold">Suas sessões neste aparelho</h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((slug) => (
              <Link
                key={slug}
                to="/s/$slug"
                params={{ slug }}
                translate="no"
                className="inline-flex min-h-10 items-center rounded-lg bg-accent-soft px-3.5 font-semibold text-accent hover:brightness-95"
              >
                {slug}
              </Link>
            ))}
          </div>
        </section>
      )}

      <CreateSession />
      <EnterSession />

      <section className={card}>
        <h2 className="m-0 text-base font-bold">Usar sem salvar</h2>
        <p className="mt-1 mb-3 text-sm text-ink-soft">
          Sem nome nem PIN. As listas ficam só neste navegador e não sincronizam.
        </p>
        <Link
          to="/local"
          className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-semibold hover:bg-accent-soft"
        >
          Abrir sem salvar
        </Link>
      </section>
    </div>
  )
}

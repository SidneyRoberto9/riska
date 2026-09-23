import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { forgetSession } from '#/data/recent'
import { forgetServerSource } from '#/data/source'
import { useSource } from '#/data/source-context'
import { useSettings } from '#/data/theme'
import { MODES, THEMES } from '#/lib/types'
import { deleteSessionFn } from '#/server/session'
import { Popover } from './Popover'

const label = 'mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase'

export function SettingsButton() {
  const source = useSource()
  return (
    <Popover
      className="w-72 space-y-4 p-3"
      trigger={(p) => (
        <button {...p} aria-label="Configurações" className="grid size-10 place-items-center rounded-xl text-xl text-ink-soft hover:bg-accent-soft hover:text-accent">
          ⚙
        </button>
      )}
    >
      {() => (
        <>
          <ThemePicker />
          {source.slug && <ShareLink slug={source.slug} />}
          {source.slug && <DeleteSession slug={source.slug} />}
        </>
      )}
    </Popover>
  )
}

function ThemePicker() {
  const { theme, mode } = useSettings()
  const a = useActions()
  return (
    <>
      <div>
        <p className={label}>Tema</p>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={theme === t.id}
              onClick={() => a.setSettings({ theme: t.id })}
              className="size-8 rounded-full ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
              style={{ background: t.swatch }}
            />
          ))}
        </div>
      </div>
      <div>
        <p className={label}>Modo</p>
        <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-line p-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => a.setSettings({ mode: m.id })}
              className="rounded-md py-1.5 aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent"
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function ShareLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(`${location.origin}/s/${slug}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="w-full rounded-lg border border-line py-2 font-semibold hover:bg-accent-soft"
    >
      {copied ? 'Link copiado ✓' : 'Copiar link da sessão'}
    </button>
  )
}

function DeleteSession({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await deleteSessionFn({ data: { slug, pin, confirm } })
      if (!r.ok) {
        setError(r.reason === 'pin' ? 'PIN incorreto' : 'Digite o slug exatamente')
        return
      }
      forgetSession(slug)
      forgetServerSource(slug)
      queryClient.removeQueries({ predicate: (q) => q.queryKey[1] === slug })
      navigate({ to: '/' })
    } catch (err) {
      if ((err as Error)?.message === 'UNAUTHORIZED') {
        router.invalidate()
        return
      }
      setError('Confira o slug e o PIN')
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-lg border border-line bg-ground px-3 py-2 outline-none focus:border-warn'
  return (
    <details className="rounded-lg border border-line p-2">
      <summary className="cursor-pointer font-semibold text-warn">Deletar sessão</summary>
      <form onSubmit={submit} className="mt-2 space-y-2">
        <p className="text-xs text-ink-soft">Apaga todas as páginas desta sessão. Não dá para desfazer.</p>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Digite "${slug}"`} className={input} />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          placeholder="PIN"
          className={input}
        />
        {error && <p role="alert" className="text-xs text-warn">{error}</p>}
        <button
          disabled={busy || confirm !== slug || pin.length !== 4}
          className="w-full rounded-lg bg-warn py-2 font-semibold text-surface disabled:opacity-40"
        >
          Deletar para sempre
        </button>
      </form>
    </details>
  )
}

import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { Check, Link2, Monitor, Moon, Settings2, Sun } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { forgetSession } from '#/data/recent'
import { forgetServerSource } from '#/data/source'
import { useSource } from '#/data/source-context'
import { useSettings } from '#/data/theme'
import { MODES, THEMES } from '#/lib/types'
import { deleteSessionFn } from '#/server/session'
import { Popover } from './Popover'

const label = 'mb-2 text-[0.82rem] font-semibold text-ink-soft'
const modeIcons = { light: Sun, dark: Moon, system: Monitor }

export function SettingsButton() {
  const source = useSource()
  return (
    <Popover
      className="w-72 space-y-4 p-3"
      trigger={(p) => (
        <button {...p} aria-label="Configurações" className="grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-accent-soft hover:text-accent">
          <Settings2 size={20} aria-hidden />
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
              className="grid size-10 place-items-center rounded-full text-white ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
              style={{ background: t.swatch }}
            >
              {theme === t.id && <Check size={18} strokeWidth={3} aria-hidden />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className={label}>Modo</p>
        <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-line p-0.5">
          {MODES.map((m) => {
            const Icon = modeIcons[m.id]
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => a.setSettings({ mode: m.id })}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-md aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent"
              >
                <Icon size={15} aria-hidden />
                {m.label}
              </button>
            )
          })}
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
        const url = `${location.origin}/s/${slug}`
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          window.prompt('Copie o link:', url)
        }
      }}
      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-line font-semibold hover:bg-accent-soft"
    >
      {copied ? <Check size={16} aria-hidden className="text-done" /> : <Link2 size={16} aria-hidden />}
      <span aria-live="polite">{copied ? 'Link copiado' : 'Copiar link da sessão'}</span>
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
        setError(r.reason === 'pin' ? 'PIN incorreto.' : 'O nome digitado não confere.')
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
      setError('Não foi possível deletar. Confira o nome e o PIN e tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-lg border border-line bg-ground px-3 py-2 focus-visible:border-warn'
  return (
    <details className="rounded-lg border border-line p-2">
      <summary className="flex min-h-8 cursor-pointer items-center font-semibold text-warn">Deletar sessão</summary>
      <form onSubmit={submit} className="mt-2 space-y-2">
        <p className="text-xs text-ink-soft">Apaga todas as páginas desta sessão. Não dá para desfazer.</p>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={`Digite ${slug}`}
          aria-label="Nome da sessão, para confirmar"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          className={input}
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          aria-label="PIN"
          className={input}
        />
        {error && <p role="alert" className="text-xs text-warn">{error}</p>}
        <button
          disabled={busy || confirm !== slug || pin.length !== 4}
          className="w-full rounded-lg bg-warn py-2 font-semibold text-surface disabled:opacity-40"
        >
          Deletar sessão
        </button>
      </form>
    </details>
  )
}

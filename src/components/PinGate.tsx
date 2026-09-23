import { Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft, LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { loginFn } from '#/server/session'

export function PinGate({ slug }: { slug: string }) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (value: string) => {
    setBusy(true)
    setError('')
    try {
      const r = await loginFn({ data: { slug, pin: value } })
      if (r.ok) {
        await router.invalidate()
        return
      }
      setPin('')
      setError(
        r.reason === 'locked'
          ? `Muitas tentativas. Tente de novo às ${new Date(r.until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
          : 'PIN incorreto. Tente de novo.',
      )
    } catch {
      setError('Sem conexão com o servidor. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 pt-20 text-center">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
        <LockKeyhole size={22} aria-hidden />
      </span>
      <h1 className="m-0 text-2xl font-extrabold break-words" translate="no">
        {slug}
      </h1>
      <p className="mt-1 text-[0.9rem] text-ink-soft">Digite o PIN de 4 dígitos para abrir esta sessão.</p>
      {/* Native input stays focusable/fillable; the four slots are only its visual */}
      <label className="relative mx-auto mt-6 grid w-fit grid-cols-4 gap-2.5 rounded-2xl has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-accent">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden
            className={`grid size-14 place-items-center rounded-2xl border-2 bg-surface transition-colors ${
              error ? 'border-warn' : i === pin.length && !busy ? 'border-accent' : 'border-line'
            }`}
          >
            {i < pin.length && <span className="size-3 rounded-full bg-ink" />}
          </span>
        ))}
        <input
          autoFocus
          value={pin}
          readOnly={busy}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          aria-label="PIN de 4 dígitos"
          aria-invalid={!!error}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4)
            setPin(v)
            setError('')
            if (v.length === 4) submit(v)
          }}
          className="absolute inset-0 cursor-text opacity-0 outline-none"
        />
      </label>
      <p role="alert" className="mt-4 min-h-5 text-sm text-warn">
        {busy ? <span className="text-ink-soft">Verificando…</span> : error}
      </p>
      <Link to="/" className="mt-6 inline-flex min-h-10 items-center gap-0.5 rounded-md px-2 text-sm text-ink-soft hover:text-accent">
        <ChevronLeft size={16} aria-hidden />
        Início
      </Link>
    </div>
  )
}

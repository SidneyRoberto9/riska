import { Link, useRouter } from '@tanstack/react-router'
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
          : 'PIN incorreto.',
      )
    } catch {
      setError('Não foi possível conectar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 pt-24 text-center">
      <h1 className="m-0 text-2xl font-extrabold">{slug}</h1>
      <p className="mt-1 text-[0.9rem] text-ink-soft">Digite o PIN de 4 dígitos</p>
      <input
        autoFocus
        value={pin}
        disabled={busy}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="PIN"
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
          setPin(v)
          if (v.length === 4) submit(v)
        }}
        className="mt-6 w-full rounded-2xl border border-line bg-surface py-4 text-center font-display text-3xl font-extrabold tracking-[0.6em] outline-none focus:border-accent"
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-warn">
          {error}
        </p>
      )}
      <Link to="/" className="mt-8 inline-block text-sm text-ink-soft hover:text-accent">
        ← Início
      </Link>
    </div>
  )
}

import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { readRecent } from '#/data/recent'
import { PIN_RE, SLUG_RE } from '#/lib/id'
import { checkSlugFn, createSessionFn } from '#/server/session'

export const Route = createFileRoute('/')({ component: Home })

const card = 'rounded-2xl border border-line bg-surface p-5'
const input = 'w-full rounded-xl border border-line bg-ground px-3 py-2.5 outline-none focus:border-accent'
const button = 'w-full rounded-xl bg-accent py-2.5 font-semibold text-surface disabled:opacity-40'
const onlySlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
const onlyPin = (v: string) => v.replace(/\D/g, '').slice(0, 4)

function Home() {
  const [recent, setRecent] = useState<string[]>([])
  useEffect(() => setRecent(readRecent()), [])

  return (
    <div className="mx-auto max-w-[720px] space-y-3.5 px-4 pt-10 pb-12">
      <header className="mb-6">
        <h1 className="m-0 text-3xl font-extrabold tracking-[-0.01em]">Checklist</h1>
        <p className="m-0 mt-1 text-ink-soft">Listas simples, sincronizadas entre celular e PC.</p>
      </header>

      {recent.length > 0 && (
        <section className={card}>
          <h2 className="m-0 mb-3 text-base font-bold">Neste aparelho</h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((slug) => (
              <Link key={slug} to="/s/$slug" params={{ slug }} className="rounded-lg bg-accent-soft px-3 py-1.5 font-semibold text-accent">
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
        <p className="mt-1 mb-3 text-sm text-ink-soft">Fica só neste navegador, sem sincronizar.</p>
        <Link to="/local" className="inline-block rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-accent-soft">
          Abrir modo anônimo
        </Link>
      </section>
    </div>
  )
}

function CreateSession() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!SLUG_RE.test(slug)) return setStatus('idle')
    let alive = true
    setStatus('checking')
    const t = setTimeout(async () => {
      const r = await checkSlugFn({ data: { slug } }).catch(() => null)
      if (alive && r) setStatus(r.available ? 'free' : 'taken')
    }, 400)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [slug])

  const valid = SLUG_RE.test(slug) && PIN_RE.test(pin) && pin === pin2 && status !== 'taken'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await createSessionFn({ data: { slug, pin } })
      if (!r.ok) {
        setStatus('taken')
        return
      }
      navigate({ to: '/s/$slug', params: { slug } })
    } catch {
      setError('Não foi possível criar a sessão.')
    } finally {
      setBusy(false)
    }
  }

  const hint = {
    idle: 'Só letras minúsculas e números, 3 a 40 caracteres. Não pode ser alterado depois.',
    checking: 'Verificando…',
    free: 'Disponível ✓',
    taken: 'Esse slug já existe.',
  }[status]

  return (
    <section className={card}>
      <h2 className="m-0 mb-3 text-base font-bold">Criar sessão</h2>
      <form onSubmit={submit} className="space-y-2.5">
        <input value={slug} onChange={(e) => setSlug(onlySlug(e.target.value))} placeholder="slug (ex: listadamaria)" aria-label="Slug" className={input} />
        <p className={`m-0 text-xs ${status === 'taken' ? 'text-warn' : status === 'free' ? 'text-done' : 'text-ink-soft'}`}>{hint}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <input value={pin} onChange={(e) => setPin(onlyPin(e.target.value))} inputMode="numeric" placeholder="PIN (4 dígitos)" aria-label="PIN" className={input} />
          <input value={pin2} onChange={(e) => setPin2(onlyPin(e.target.value))} inputMode="numeric" placeholder="Repita o PIN" aria-label="Repita o PIN" className={input} />
        </div>
        {pin2.length === 4 && pin !== pin2 && <p className="m-0 text-xs text-warn">Os PINs não conferem.</p>}
        {error && <p role="alert" className="m-0 text-xs text-warn">{error}</p>}
        <button disabled={!valid || busy} className={button}>
          Criar
        </button>
      </form>
    </section>
  )
}

function EnterSession() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (SLUG_RE.test(slug)) navigate({ to: '/s/$slug', params: { slug } })
  }
  return (
    <section className={card}>
      <h2 className="m-0 mb-3 text-base font-bold">Entrar em uma sessão</h2>
      <form onSubmit={submit} className="flex gap-2.5">
        <input value={slug} onChange={(e) => setSlug(onlySlug(e.target.value))} placeholder="slug" aria-label="Slug da sessão" className={input} />
        <button disabled={!SLUG_RE.test(slug)} className="rounded-xl bg-accent px-5 font-semibold text-surface disabled:opacity-40">
          Entrar
        </button>
      </form>
    </section>
  )
}

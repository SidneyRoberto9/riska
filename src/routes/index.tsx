import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Check, CircleAlert, LoaderCircle } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { readRecent } from "#/data/recent"
import { PIN_RE, SLUG_RE } from "#/lib/id"
import { checkSlugFn, createSessionFn } from "#/server/session"

export const Route = createFileRoute("/")({ component: Home })

const card = "rounded-2xl border border-line bg-surface p-5"
const input =
  "w-full min-w-0 rounded-xl border border-line bg-ground px-3 py-2.5 focus-visible:border-accent focus-visible:outline-offset-0"
const button =
  "min-h-11 rounded-xl bg-accent px-5 font-semibold text-surface hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
const fieldLabel = "mb-1.5 block text-[0.82rem] font-semibold text-ink-soft"
// Session names double as URLs, so no autocorrect/capitalization on mobile keyboards
const nameProps = { autoComplete: "off", autoCapitalize: "none", autoCorrect: "off", spellCheck: false } as const
const pinProps = { type: "password", inputMode: "numeric", maxLength: 4, autoComplete: "off" } as const
const onlySlug = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 40)
const onlyPin = (v: string) => v.replace(/\D/g, "").slice(0, 4)

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

function CreateSession() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState("")
  const [pin, setPin] = useState("")
  const [pin2, setPin2] = useState("")
  const [status, setStatus] = useState<"idle" | "checking" | "free" | "taken">("idle")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!SLUG_RE.test(slug)) {
      return setStatus("idle")
    }
    let alive = true
    setStatus("checking")
    const t = setTimeout(async () => {
      const r = await checkSlugFn({ data: { slug } }).catch(() => null)
      if (alive && r) {
        setStatus(r.available ? "free" : "taken")
      }
    }, 400)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [slug])

  const valid = SLUG_RE.test(slug) && PIN_RE.test(pin) && pin === pin2 && status !== "taken"

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const r = await createSessionFn({ data: { slug, pin } })
      if (!r.ok) {
        setStatus("taken")
        return
      }
      navigate({ to: "/s/$slug", params: { slug } })
    } catch {
      setError("Não foi possível criar a sessão. Confira sua conexão e tente de novo.")
    } finally {
      setBusy(false)
    }
  }

  const hint = {
    idle: { icon: null, text: "Letras minúsculas e números, de 3 a 40. Vira o endereço da sessão e não muda depois." },
    checking: { icon: LoaderCircle, text: "Verificando…" },
    free: { icon: Check, text: `Disponível: /s/${slug}` },
    taken: { icon: CircleAlert, text: "Esse nome já está em uso. Escolha outro." },
  }[status]
  const HintIcon = hint.icon
  const mismatch = pin2.length === 4 && pin !== pin2

  return (
    <section className={card}>
      <h2 className="m-0 mb-1 text-base font-bold">Criar sessão</h2>
      <p className="mt-0 mb-4 text-sm text-ink-soft">
        Use o mesmo nome e PIN no celular e no PC para ver as mesmas listas.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="new-slug" className={fieldLabel}>
            Nome da sessão
          </label>
          <input
            id="new-slug"
            name="session"
            value={slug}
            onChange={(e) => setSlug(onlySlug(e.target.value))}
            placeholder="ex: listadamaria…"
            aria-describedby="new-slug-hint"
            aria-invalid={status === "taken"}
            className={input}
            {...nameProps}
          />
          <p
            id="new-slug-hint"
            aria-live="polite"
            className={`m-0 mt-1.5 flex items-center gap-1.5 text-xs ${status === "taken" ? "text-warn" : status === "free" ? "text-done" : "text-ink-soft"}`}
          >
            {HintIcon && <HintIcon size={14} aria-hidden className={status === "checking" ? "animate-spin" : ""} />}
            {hint.text}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="new-pin" className={fieldLabel}>
              PIN de 4 dígitos
            </label>
            <input
              id="new-pin"
              value={pin}
              onChange={(e) => setPin(onlyPin(e.target.value))}
              className={input}
              {...pinProps}
            />
          </div>
          <div>
            <label htmlFor="new-pin2" className={fieldLabel}>
              Repita o PIN
            </label>
            <input
              id="new-pin2"
              value={pin2}
              onChange={(e) => setPin2(onlyPin(e.target.value))}
              aria-invalid={mismatch}
              className={input}
              {...pinProps}
            />
          </div>
        </div>
        {mismatch && <p className="m-0 text-xs text-warn">Os PINs não conferem.</p>}
        {error && (
          <p role="alert" className="m-0 text-xs text-warn">
            {error}
          </p>
        )}
        <button disabled={!valid || busy} className={`${button} w-full`}>
          {busy ? "Criando…" : "Criar sessão"}
        </button>
      </form>
    </section>
  )
}

function EnterSession() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState("")
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (SLUG_RE.test(slug)) {
      navigate({ to: "/s/$slug", params: { slug } })
    }
  }
  return (
    <section className={card}>
      <h2 className="m-0 mb-3 text-base font-bold">Entrar em uma sessão</h2>
      <form onSubmit={submit}>
        <label htmlFor="enter-slug" className={fieldLabel}>
          Nome da sessão
        </label>
        <div className="flex gap-2.5">
          <input
            id="enter-slug"
            name="session"
            value={slug}
            onChange={(e) => setSlug(onlySlug(e.target.value))}
            placeholder="ex: listadamaria…"
            className={input}
            {...nameProps}
          />
          <button disabled={!SLUG_RE.test(slug)} className={button}>
            Entrar
          </button>
        </div>
      </form>
    </section>
  )
}

import { useNavigate } from "@tanstack/react-router"
import { Check, CircleAlert, LoaderCircle } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { PIN_RE, SLUG_RE } from "#/lib/id"
import { checkSlugFn, createSessionFn } from "#/server/session"
import { button, card, fieldLabel, input, nameProps, onlySlug, pinProps } from "./sessionForm"

const onlyPin = (v: string) => v.replace(/\D/g, "").slice(0, 4)

export function CreateSession() {
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

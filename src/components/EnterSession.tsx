import { useNavigate } from "@tanstack/react-router"
import { type FormEvent, useState } from "react"
import { SLUG_RE } from "#/lib/id"
import { button, card, fieldLabel, input, nameProps, onlySlug } from "./sessionForm"

export function EnterSession() {
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

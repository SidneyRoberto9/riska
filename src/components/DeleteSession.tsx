import { useQueryClient } from "@tanstack/react-query"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { type FormEvent, useState } from "react"
import { forgetSession } from "#/data/recent"
import { forgetServerSource } from "#/data/source"
import { deleteSessionFn } from "#/server/session"

export function DeleteSession({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const r = await deleteSessionFn({ data: { slug, pin, confirm } })
      if (!r.ok) {
        setError(r.reason === "pin" ? "PIN incorreto." : "O nome digitado não confere.")
        return
      }
      forgetSession(slug)
      forgetServerSource(slug)
      queryClient.removeQueries({ predicate: (q) => q.queryKey[1] === slug })
      navigate({ to: "/" })
    } catch (err) {
      if ((err as Error)?.message === "UNAUTHORIZED") {
        router.invalidate()
        return
      }
      setError("Não foi possível deletar. Confira o nome e o PIN e tente de novo.")
    } finally {
      setBusy(false)
    }
  }

  const input = "w-full rounded-lg border border-line bg-ground px-3 py-2 focus-visible:border-warn"
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
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          aria-label="PIN"
          className={input}
        />
        {error && (
          <p role="alert" className="text-xs text-warn">
            {error}
          </p>
        )}
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

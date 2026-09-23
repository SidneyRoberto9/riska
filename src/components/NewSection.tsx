import { Plus } from "lucide-react"
import { type FormEvent, useState } from "react"
import { LIMITS } from "#/lib/types"

export function NewSection({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("")
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = title.trim()
    if (!v) {
      return
    }
    onAdd(v)
    setTitle("")
  }
  return (
    <form
      onSubmit={submit}
      className="mb-3.5 flex items-center gap-2 rounded-2xl border border-dashed border-line p-2 pl-4 focus-within:border-accent"
    >
      <Plus size={18} aria-hidden className="shrink-0 text-ink-soft" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={LIMITS.title}
        placeholder="Nova seção…"
        aria-label="Nova seção"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-lg bg-transparent py-2 font-display font-bold outline-none placeholder:text-ink-soft"
      />
      {title.trim() && (
        <button className="min-h-10 rounded-xl bg-accent px-4 font-semibold text-surface">Criar seção</button>
      )}
    </form>
  )
}

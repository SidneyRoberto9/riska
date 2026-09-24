import { Plus, X } from "lucide-react"
import { type FormEvent, useRef, useState } from "react"
import { useActions } from "#/data/actions"
import { LIMITS, type Section, type Status } from "#/lib/types"
import { VoiceButton } from "./VoiceButton"

export function BoardAddCard({ status, sections }: { status: Status; sections: Section[] }) {
  const a = useActions()
  const key = `checklist-board-section-${status.pageId}`
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [sectionId, setSectionId] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const refocus = useRef(false)
  const section = sections.find((s) => s.id === sectionId) ?? sections[0]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) {
      return
    }
    a.addTask({ section, text: v, status })
    setText("")
    input.current?.focus()
  }

  // Re-read on open: another column may have picked a section since
  const show = () => {
    try {
      setSectionId(localStorage.getItem(key) ?? "")
    } catch {}
    setOpen(true)
  }
  const hide = () => {
    refocus.current = true
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        ref={(el) => {
          if (el && refocus.current) {
            refocus.current = false
            el.focus()
          }
        }}
        onClick={show}
        className="mx-2 mb-2 flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm text-ink-soft hover:bg-accent-soft hover:text-accent"
      >
        <Plus size={16} aria-hidden />
        Adicionar tarefa
      </button>
    )
  }
  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          hide()
        }
      }}
      className="mx-2 mb-2 space-y-2 rounded-xl border border-accent bg-surface p-2"
    >
      <div className="flex items-center gap-1">
        <input
          ref={input}
          // biome-ignore lint/a11y/noAutofocus: rendered only right after the user asks to type here (opened editor / PIN screen)
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LIMITS.task}
          placeholder="Nova tarefa…"
          aria-label={`Nova tarefa em ${status.name}`}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md bg-transparent px-2.5 py-1.5 text-[0.9rem] outline-none placeholder:text-ink-soft"
        />
        <VoiceButton value={text} onChange={setText} />
      </div>
      <div className="flex items-center gap-2">
        {sections.length > 1 && (
          <select
            value={section.id}
            onChange={(e) => {
              setSectionId(e.target.value)
              try {
                localStorage.setItem(key, e.target.value)
              } catch {}
            }}
            aria-label="Seção"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-ground px-2 text-sm"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={!text.trim()}
          className="ml-auto min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-surface disabled:opacity-40"
        >
          Adicionar
        </button>
        <button
          type="button"
          onClick={hide}
          aria-label="Fechar"
          className="grid size-10 place-items-center rounded-lg text-ink-soft hover:bg-accent-soft"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </form>
  )
}

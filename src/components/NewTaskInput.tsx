import { Plus } from "lucide-react"
import { type FormEvent, useState } from "react"
import { useActions } from "#/data/actions"
import { LIMITS, type Section } from "#/lib/types"
import { VoiceButton } from "./VoiceButton"

export function NewTaskInput({ section }: { section: Section }) {
  const a = useActions()
  const [text, setText] = useState("")
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) {
      return
    }
    a.addTask(section, v)
    setText("")
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 border-t border-line py-1.5 pl-1">
      <Plus size={19} aria-hidden className="shrink-0 text-ink-soft" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={LIMITS.task}
        placeholder="Nova tarefa…"
        autoComplete="off"
        aria-label="Nova tarefa"
        className="min-w-0 flex-1 rounded-md bg-transparent px-3 py-1.5 text-[0.92rem] placeholder:text-ink-soft"
      />
      <VoiceButton value={text} onChange={setText} />
    </form>
  )
}

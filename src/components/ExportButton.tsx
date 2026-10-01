import { Download, X } from "lucide-react"
import { type FormEvent, useId, useRef, useState } from "react"
import { EXPORT_COLUMNS, toCsv } from "#/lib/export"
import type { Section, Status, Task } from "#/lib/types"

// Exports the page's tasks to a CSV built in the browser (no network, so it works the same in local mode)
export function ExportButton({
  title,
  sections,
  statuses,
  tasks,
}: {
  title: string
  sections: Section[]
  statuses: Status[]
  tasks: Task[]
}) {
  const ref = useRef<HTMLDialogElement>(null)
  // Backdrop close needs press and release on the backdrop: a text selection dragged out of the dialog doesn't count
  const downOnBackdrop = useRef(false)
  const headingId = useId()
  const [ids, setIds] = useState(() => EXPORT_COLUMNS.filter((c) => c.on).map((c) => c.id))

  const toggle = (id: string, on: boolean) =>
    setIds((prev) =>
      on ? EXPORT_COLUMNS.map((c) => c.id).filter((x) => x === id || prev.includes(x)) : prev.filter((x) => x !== id)
    )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const url = URL.createObjectURL(new Blob([toCsv(ids, tasks, { statuses, sections })], { type: "text/csv" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${title.replace(/[\\/:*?"<>|]/g, "-").trim() || "tarefas"}.csv`
    link.click()
    // Deferred: Safari can drop the download if the URL is revoked in the same tick
    setTimeout(() => URL.revokeObjectURL(url))
    ref.current?.close()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label="Exportar tarefas"
        title="Exportar tarefas"
        className="grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-accent-soft hover:text-accent"
      >
        <Download size={18} aria-hidden />
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click to close; Esc is native to <dialog> */}
      <dialog
        ref={ref}
        aria-labelledby={headingId}
        onPointerDown={(e) => {
          downOnBackdrop.current = e.target === ref.current
        }}
        onClick={(e) => {
          if (downOnBackdrop.current && e.target === ref.current) {
            ref.current.close()
          }
        }}
        className="task-dialog"
      >
        <form onSubmit={submit} className="flex max-h-[inherit] flex-col">
          <header className="flex items-center gap-3 border-b border-line py-2 pr-3 pl-4">
            <h2 id={headingId} className="m-0 flex-1 text-[1.15rem] font-bold">
              Exportar tarefas
            </h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Fechar"
              className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-accent"
            >
              <X size={18} aria-hidden />
            </button>
          </header>
          <fieldset className="m-0 flex-1 space-y-1 overflow-y-auto border-0 px-4 pb-4">
            <legend className="mb-2 pt-4 text-sm text-ink-soft">
              Escolha as colunas da planilha (CSV, {tasks.length} {tasks.length === 1 ? "tarefa" : "tarefas"}).
            </legend>
            {EXPORT_COLUMNS.map((c) => (
              <label
                key={c.id}
                className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-accent-soft"
              >
                <input
                  type="checkbox"
                  checked={ids.includes(c.id)}
                  onChange={(e) => toggle(c.id, e.target.checked)}
                  className="size-4 accent-accent"
                />
                {c.label}
              </label>
            ))}
          </fieldset>
          <footer className="flex justify-end gap-2 border-t border-line p-3">
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="min-h-10 rounded-lg px-3 text-ink-soft hover:bg-accent-soft hover:text-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!ids.length}
              className="flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 font-semibold text-surface disabled:opacity-40"
            >
              <Download size={16} aria-hidden />
              Exportar
            </button>
          </footer>
        </form>
      </dialog>
    </>
  )
}

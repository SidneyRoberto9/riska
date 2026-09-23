import { Trash2, X } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { useActions } from "#/data/actions"
import { statusOf } from "#/lib/status"
import { LIMITS, type Section, type Status, type Task } from "#/lib/types"
import { InlineEdit } from "./InlineEdit"
import { StatusChip, StatusPicker } from "./Status"
import { VoiceButton } from "./VoiceButton"

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" })
const relFmt = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
]

function relative(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, n] of UNITS) {
    if (Math.abs(s) >= n) {
      return relFmt.format(Math.round(s / n), unit)
    }
  }
  return "agora"
}

// Every way of closing (X, Esc, backdrop) goes through dialog.close() → onClose; the note is saved on blur and on unmount
export function TaskDialog({
  task,
  statuses,
  section,
  onClose,
}: {
  task: Task
  statuses: Status[]
  section?: Section
  onClose: () => void
}) {
  const a = useActions()
  const ref = useRef<HTMLDialogElement>(null)
  // Backdrop close needs press and release on the backdrop: a text selection dragged out of the dialog doesn't count
  const downOnBackdrop = useRef(false)
  const titleId = useId()
  const noteId = useId()
  const [note, setNote] = useState(task.note)
  const latest = useRef({ note, task })
  // Committed values for the blur/unmount save (not written during render)
  useLayoutEffect(() => {
    latest.current = { note, task }
  })
  const status = statusOf(task, statuses)

  const saveNote = () => {
    const { note, task } = latest.current
    const v = note.trim()
    if (v !== task.note) {
      a.updateTask(task.id, { note: v })
    }
  }

  useEffect(() => {
    ref.current?.showModal()
    return saveNote
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
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
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start gap-3 border-b border-line p-4 pr-3">
          <label className="-m-2.75 -mt-0.75 cursor-pointer p-2.75">
            <input
              type="checkbox"
              className="check"
              checked={task.done}
              onChange={(e) => a.setTaskDone(task, e.target.checked)}
              aria-label="Concluída"
            />
          </label>
          <h2 id={titleId} className="m-0 min-w-0 flex-1 text-[1.15rem] leading-snug font-bold">
            <InlineEdit
              value={task.text}
              required
              multiline
              maxLength={LIMITS.task}
              label="Título da tarefa"
              voice="Ditar título"
              onSave={(text) => a.updateTask(task.id, { text })}
              className={task.done ? "text-ink-soft line-through decoration-ink-soft/40" : ""}
            />
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Fechar"
            className="-mt-1.5 grid size-10 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-accent"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
          <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2.5 text-sm">
            <dt className="text-ink-soft">Status</dt>
            <dd className="m-0">
              {status && (
                <StatusPicker
                  task={task}
                  statuses={statuses}
                  trigger={(p) => (
                    <StatusChip
                      {...p}
                      status={status}
                      aria-label={`Status: ${status.name}. Alterar`}
                      className="px-2 py-0.5 text-[0.75rem]"
                    />
                  )}
                />
              )}
            </dd>
            {section && (
              <>
                <dt className="text-ink-soft">Seção</dt>
                <dd className="m-0">{section.title}</dd>
              </>
            )}
            {task.createdAt && (
              <>
                <dt className="text-ink-soft">Criada</dt>
                <dd className="m-0">
                  <time dateTime={task.createdAt}>{dateFmt.format(new Date(task.createdAt))}</time>
                  <span className="text-ink-soft"> · {relative(task.createdAt)}</span>
                </dd>
              </>
            )}
          </dl>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor={noteId} className="text-sm font-semibold">
                Descrição
              </label>
              <VoiceButton value={note} onChange={setNote} label="Ditar descrição" />
            </div>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              maxLength={LIMITS.taskNote}
              placeholder="Adicione uma descrição…"
              className="block min-h-28 w-full resize-none rounded-xl border border-line bg-ground p-3 text-[0.92rem] leading-relaxed field-sizing-content focus-visible:border-accent focus-visible:outline-offset-0"
            />
            {note.length > LIMITS.taskNote - 200 && (
              <p className="m-0 mt-1 text-right text-xs tabular-nums text-ink-soft">
                {note.length}/{LIMITS.taskNote}
              </p>
            )}
          </div>
        </div>

        <footer className="flex justify-end border-t border-line p-3">
          <button
            type="button"
            onClick={() => {
              a.deleteTask(task.id)
              ref.current?.close()
            }}
            className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-warn hover:bg-warn-soft"
          >
            <Trash2 size={16} aria-hidden />
            Deletar tarefa
          </button>
        </footer>
      </div>
    </dialog>
  )
}

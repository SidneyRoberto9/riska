import { Loader2, X } from "lucide-react"
import { type FormEvent, useEffect, useId, useRef, useState } from "react"
import { useActions } from "#/data/actions"
import { useImagesEnabled } from "#/data/images"
import { readLastSection, writeLastSection } from "#/data/lastSection"
import { useSource } from "#/data/source-context"
import { useUploads } from "#/data/useUploads"
import { pastedImages } from "#/lib/images"
import { LIMITS, type Section, type Status } from "#/lib/types"
import { AssigneeInput } from "./AssigneeInput"
import { ColumnChips } from "./ColumnChips"
import { FIELD, LABEL } from "./fieldStyles"
import { ImageField } from "./ImageField"
import { useToast } from "./ToastProvider"
import { useBlockEscape } from "./useBlockEscape"
import { VoiceButton } from "./VoiceButton"

export type NewTaskTarget = { sectionId?: string; statusId?: string }

// The single way to create a task (list and board): short title, description, assignee, column, images.
// While images upload nothing closes it; the task is created once, a failed image only retries the upload.
export function TaskCreateDialog({
  pageId,
  sections,
  statuses,
  assignees,
  initial,
  onClose,
}: {
  pageId: string
  sections: Section[]
  statuses: Status[]
  assignees: string[]
  initial: NewTaskTarget
  onClose: () => void
}) {
  const a = useActions()
  const toast = useToast()
  const source = useSource()
  const uploads = useUploads()
  const images = useImagesEnabled()
  const ref = useRef<HTMLDialogElement>(null)
  // Backdrop close needs press and release on the backdrop: a text selection dragged out of the dialog doesn't count
  const downOnBackdrop = useRef(false)
  const titleInput = useRef<HTMLInputElement>(null)
  const headingId = useId()
  const titleId = useId()
  const noteId = useId()
  const assigneeId = useId()
  const sectionFieldId = useId()
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [assignee, setAssignee] = useState("")
  const [statusId, setStatusId] = useState(initial.statusId ?? statuses[0]?.id)
  const [sectionId, setSectionId] = useState(() => {
    const id = initial.sectionId ?? readLastSection(pageId)
    return (sections.find((s) => s.id === id) ?? sections[0])?.id
  })
  const [createdId, setCreatedId] = useState<string | null>(null)
  // Covers the whole submit, not just the moments an item is marked "uploading"
  const [saving, setSaving] = useState(false)
  const busy = saving || uploads.busy
  const created = createdId !== null

  useEffect(() => {
    ref.current?.showModal()
    // After showModal: React's autoFocus runs before it and showModal() moves focus to the first button
    titleInput.current?.focus()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) {
      return
    }
    const section = sections.find((s) => s.id === sectionId) ?? sections[0]
    const text = title.trim()
    if (!section || !text) {
      return
    }
    // A retry after a failed image must not create the task twice
    const id =
      createdId ??
      a.addTask({
        section,
        text,
        note: note.trim(),
        assignee: assignee.trim(),
        status: statuses.find((s) => s.id === statusId),
      })
    setCreatedId(id)
    if (uploads.items.length) {
      setSaving(true)
      const ok = await uploads.start({ id, pageId: section.pageId })
      setSaving(false)
      if (!ok) {
        return // failed thumbnails show "Falhou"; the button now reads "Tentar de novo"
      }
    }
    ref.current?.close()
  }

  useBlockEscape(busy)

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click to close, Esc is handled natively by <dialog>
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onCancel={(e) => {
        if (busy) {
          e.preventDefault()
        }
      }}
      onClose={(e) => {
        if (e.target !== e.currentTarget) {
          return
        }
        if (createdId && uploads.items.length) {
          toast("Tarefa criada sem algumas imagens.")
        }
        onClose()
      }}
      onPaste={(e) => {
        const files = pastedImages(e.target as HTMLElement, e.clipboardData)
        if (images && files.length) {
          e.preventDefault()
          uploads.add(files, 0)
        }
      }}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === ref.current
      }}
      onClick={(e) => {
        if (!busy && downOnBackdrop.current && e.target === ref.current) {
          ref.current.close()
        }
      }}
      className="task-dialog"
    >
      <form
        onSubmit={submit}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.currentTarget.requestSubmit()
          }
        }}
        className="flex max-h-[inherit] flex-col"
      >
        <header className="flex items-center gap-3 border-b border-line py-2 pr-3 pl-4">
          <h2 id={headingId} className="m-0 flex-1 text-[1.15rem] font-bold">
            Nova tarefa
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            disabled={busy}
            aria-label="Fechar"
            className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-accent disabled:opacity-40"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain p-4">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor={titleId} className={LABEL}>
                Título
              </label>
              {!created && <VoiceButton value={title} onChange={setTitle} label="Ditar título" />}
            </div>
            <input
              id={titleId}
              required
              ref={titleInput}
              readOnly={created}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={LIMITS.taskTitle}
              autoComplete="off"
              aria-describedby={`${titleId}-hint`}
              className={FIELD}
            />
            <div className="mt-1 flex gap-2 text-xs text-ink-soft">
              <p id={`${titleId}-hint`} className="m-0 flex-1">
                Curto. Detalhes vão na descrição.
              </p>
              {title.length > 100 && (
                <p className="m-0 tabular-nums">
                  {title.length}/{LIMITS.taskTitle}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor={noteId} className={LABEL}>
                Descrição
              </label>
              {!created && <VoiceButton value={note} onChange={setNote} label="Ditar descrição" />}
            </div>
            <textarea
              id={noteId}
              readOnly={created}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={LIMITS.taskNote}
              className={`${FIELD} min-h-24 resize-none field-sizing-content`}
            />
          </div>

          {/* The task already exists after the first submit: its details are edited in the task dialog */}
          <fieldset disabled={created} className="m-0 min-w-0 space-y-4 border-0 p-0">
            <div>
              <label htmlFor={assigneeId} className={LABEL}>
                Responsável <span className="font-normal text-ink-soft">(opcional)</span>
              </label>
              <AssigneeInput id={assigneeId} value={assignee} onChange={setAssignee} options={assignees} />
            </div>

            <div>
              <span className={LABEL}>Coluna</span>
              <ColumnChips statuses={statuses} value={statusId} onChange={(s) => setStatusId(s.id)} />
            </div>

            {sections.length > 1 && (
              <div>
                <label htmlFor={sectionFieldId} className={LABEL}>
                  Seção
                </label>
                <select
                  id={sectionFieldId}
                  value={sectionId}
                  onChange={(e) => {
                    setSectionId(e.target.value)
                    writeLastSection(pageId, e.target.value)
                  }}
                  className={FIELD}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>

          {images && (
            <div>
              <span className={LABEL}>
                Imagens <span className="font-normal text-ink-soft">(opcional)</span>
              </span>
              <ImageField
                slug={source.slug ?? ""}
                attachments={[]}
                uploads={uploads}
                onFiles={(f) => uploads.add(f, 0)}
                onOpen={() => {}}
              />
              <p className="m-0 mt-1.5 text-xs text-ink-soft">
                Arraste, cole (Ctrl+V) ou clique. PNG, JPEG, WebP, GIF ou AVIF até 10 MB.
              </p>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line p-3">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            disabled={busy}
            className="min-h-10 rounded-lg px-3 text-ink-soft hover:bg-accent-soft hover:text-accent disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 font-semibold text-surface disabled:opacity-40"
          >
            {busy && <Loader2 size={16} aria-hidden className="animate-spin" />}
            {createdId && !busy ? "Tentar de novo" : "Criar tarefa"}
          </button>
        </footer>
      </form>
    </dialog>
  )
}

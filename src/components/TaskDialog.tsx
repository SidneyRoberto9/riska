import { Trash2, X } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useActions } from "#/data/actions"
import { imageSrc, useImagesEnabled } from "#/data/images"
import { useSource } from "#/data/source-context"
import { useUploads } from "#/data/useUploads"
import { pastedImages } from "#/lib/images"
import { statusOf } from "#/lib/status"
import { titleMax } from "#/lib/task"
import { formatDate, relative } from "#/lib/time"
import { type Attachment, LIMITS, type Section, type Status, type Task } from "#/lib/types"
import { AssigneeInput } from "./AssigneeInput"
import { ColumnChips } from "./ColumnChips"
import { FIELD } from "./fieldStyles"
import { fileDrop } from "./fileDrop"
import { ImageField } from "./ImageField"
import { ImageLightbox } from "./ImageLightbox"
import { InlineEdit } from "./InlineEdit"
import { VoiceButton } from "./VoiceButton"

// Every way of closing (X, Esc, backdrop) goes through dialog.close() → onClose. Title, note and assignee are
// drafts written only by "Salvar"; closing with unsaved drafts asks first. Closing while images upload is fine: the uploader keeps going and inserts the rows,
// and an image that then fails is reported by a toast.
export function TaskDialog({
  task,
  statuses,
  section,
  assignees,
  attachments,
  onClose,
}: {
  task: Task
  statuses: Status[]
  section?: Section
  assignees: string[]
  attachments: Attachment[]
  onClose: () => void
}) {
  const a = useActions()
  const source = useSource()
  const slug = source.slug ?? ""
  const images = useImagesEnabled()
  const uploads = useUploads()
  const [viewing, setViewing] = useState<number | null>(null)
  // The thumbnail that opened the lightbox gets focus back when it closes
  const opener = useRef<HTMLElement | null>(null)
  const ref = useRef<HTMLDialogElement>(null)
  // Backdrop close needs press and release on the backdrop: a text selection dragged out of the dialog doesn't count
  const downOnBackdrop = useRef(false)
  const titleId = useId()
  const noteId = useId()
  const assigneeId = useId()
  const [text, setText] = useState(task.text)
  const [note, setNote] = useState(task.note)
  const [assignee, setAssignee] = useState(task.assignee ?? "")
  // What the fields showed on open: only a field the user changed is written, so an edit made on another
  // device meanwhile isn't overwritten with the stale value
  const [initial] = useState({ text: task.text, note: task.note, assignee: task.assignee ?? "" })
  const changes: { text?: string; note?: string; assignee?: string } = {}
  if (text.trim() && text.trim() !== initial.text.trim()) {
    changes.text = text.trim()
  }
  if (note.trim() !== initial.note.trim()) {
    changes.note = note.trim()
  }
  if (assignee.trim() !== initial.assignee.trim()) {
    changes.assignee = assignee.trim()
  }
  const dirty = Object.keys(changes).length > 0
  const failed = uploads.items.some((u) => u.state === "error")
  // The viewed image was deleted (here or on another device): drop the lightbox
  if (viewing !== null && viewing >= attachments.length) {
    setViewing(null)
  }

  const save = () => {
    if (dirty) {
      a.updateTask(task.id, changes)
    }
    ref.current?.close()
  }

  const discardOk = () => !dirty || confirm("Descartar as alterações não salvas?")
  const requestClose = () => {
    if (discardOk()) {
      ref.current?.close()
    }
  }

  const addFiles = (files: File[]) => {
    uploads.add(files, attachments.length)
    void uploads.start({ id: task.id, pageId: task.pageId })
  }

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click to close, Esc is handled natively by <dialog>
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        if (e.target === e.currentTarget && !discardOk()) {
          e.preventDefault()
        }
      }}
      // The lightbox is a nested <dialog>: its close event reaches this handler through React, ignore it
      onClose={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      onPaste={(e) => {
        const files = pastedImages(e.target as HTMLElement, e.clipboardData)
        if (images && viewing === null && files.length > 0) {
          e.preventDefault()
          addFiles(files)
        }
      }}
      {...fileDrop(images && viewing === null ? addFiles : undefined)}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === ref.current
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === ref.current) {
          requestClose()
        }
      }}
      className="task-dialog"
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start gap-3 border-b border-line p-4 pr-3">
          <label className="-m-2.75 -mt-2.25 cursor-pointer p-2.75">
            <input
              type="checkbox"
              className="check"
              checked={task.done}
              onChange={(e) => a.setTaskDone(task, e.target.checked)}
              aria-label="Concluída"
            />
          </label>
          <h2 id={titleId} className="m-0 min-w-0 flex-1 text-base leading-snug font-semibold">
            <InlineEdit
              value={text}
              required
              multiline
              maxLength={titleMax(task.text)}
              label="Título da tarefa"
              voice="Ditar título"
              onSave={setText}
              className={task.done ? "text-ink-soft line-through decoration-ink-soft/40" : ""}
            />
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Fechar"
            className="-mt-2 grid size-10 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-accent"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain p-4">
          <dl className="m-0 grid grid-cols-[auto_1fr] items-start gap-x-5 gap-y-2.5 text-sm">
            <dt className="pt-2 text-ink-soft">Coluna</dt>
            <dd className="m-0 min-w-0">
              <ColumnChips
                statuses={statuses}
                value={statusOf(task, statuses)?.id}
                onChange={(s) => a.setTaskStatus(task, s)}
              />
            </dd>
            <dt className="pt-2 text-ink-soft">
              <label htmlFor={assigneeId}>Responsável</label>
            </dt>
            <dd className="m-0 min-w-0">
              <AssigneeInput id={assigneeId} value={assignee} onChange={setAssignee} options={assignees} />
            </dd>
            {section && (
              <>
                <dt className="pt-2 text-ink-soft">Seção</dt>
                <dd className="m-0 pt-2">{section.title}</dd>
              </>
            )}
            {task.createdAt && (
              <>
                <dt className="pt-2 text-ink-soft">Criada</dt>
                <dd className="m-0 pt-2">
                  <time dateTime={task.createdAt}>{formatDate(task.createdAt)}</time>
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
              maxLength={LIMITS.taskNote}
              placeholder="Adicione uma descrição…"
              className={`${FIELD} min-h-28 resize-none leading-relaxed field-sizing-content`}
            />
            {note.length > LIMITS.taskNote - 200 && (
              <p className="m-0 mt-1 text-right text-xs tabular-nums text-ink-soft">
                {note.length}/{LIMITS.taskNote}
              </p>
            )}
          </div>

          {images && (
            <div>
              <h3 className="m-0 mb-1.5 text-sm font-semibold">
                Imagens{" "}
                {attachments.length > 0 && <span className="font-normal text-ink-soft">({attachments.length})</span>}
              </h3>
              <ImageField
                slug={slug}
                attachments={attachments}
                uploads={uploads}
                onFiles={addFiles}
                onOpen={(i, el) => {
                  opener.current = el ?? null
                  setViewing(i)
                }}
                onRemove={a.removeAttachment}
              />
              <p className="m-0 mt-1.5 text-xs text-ink-soft">
                Arraste, cole (Ctrl+V) ou clique. PNG, JPEG, WebP, GIF ou AVIF até 10 MB.
              </p>
              {failed && (
                <p role="alert" className="m-0 mt-1.5 flex items-center gap-2 text-sm text-warn">
                  Algumas imagens falharam.
                  <button
                    type="button"
                    onClick={() => void uploads.start({ id: task.id, pageId: task.pageId })}
                    disabled={uploads.busy}
                    className="min-h-10 rounded-lg px-2 font-semibold underline underline-offset-2 hover:bg-warn-soft disabled:opacity-40"
                  >
                    Tentar de novo
                  </button>
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="flex justify-between gap-2 border-t border-line p-3">
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
          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-surface hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
          >
            Salvar
          </button>
        </footer>
      </div>
      {viewing !== null && (
        <ImageLightbox
          key={viewing}
          images={attachments.map((x) => ({ src: imageSrc(slug, x.id), name: x.name }))}
          index={viewing}
          onClose={() => {
            setViewing(null)
            opener.current?.focus()
          }}
        />
      )}
    </dialog>
  )
}

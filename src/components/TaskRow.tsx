import { ArrowDown, ArrowUp, CircleDot, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { chipHidden, statusOf } from '#/lib/status'
import { LIMITS, type Section, type Status, type Task } from '#/lib/types'
import { InlineEdit } from './InlineEdit'
import { Menu, MenuItem } from './Popover'
import { StatusChip, StatusOptions, StatusPicker } from './Status'
import { VoiceButton } from './VoiceButton'

export function TaskRow({ task, siblings, statuses }: { task: Task; siblings: Task[]; statuses: Status[] }) {
  const a = useActions()
  const [menu, setMenu] = useState<'actions' | 'status'>('actions')
  const [editingNote, setEditingNote] = useState(false)
  const i = siblings.findIndex((t) => t.id === task.id)
  const status = statusOf(task, statuses)

  return (
    <div className="group flex items-start gap-2.5 border-t border-line py-2 pl-1 first:border-t-0">
      <label className="-m-3 cursor-pointer p-3">
        <input
          type="checkbox"
          className="check"
          checked={task.done}
          onChange={(e) => a.setTaskDone(task, e.target.checked)}
          aria-label={`Concluída: ${task.text}`}
        />
      </label>
      <div className="min-w-0 flex-1 text-[0.92rem] leading-[1.42]">
        <InlineEdit
          value={task.text}
          required
          multiline
          maxLength={LIMITS.task}
          label="Texto da tarefa"
          onSave={(text) => a.updateTask(task.id, { text })}
          className={task.done ? 'text-ink-soft line-through decoration-ink-soft/40' : ''}
        />
        {status && !chipHidden(task, statuses) && (
          <StatusPicker
            task={task}
            statuses={statuses}
            trigger={(p) => <StatusChip {...p} status={status} aria-label={`Status: ${status.name}. Alterar`} className="ml-1.5" />}
          />
        )}
        {(task.note || editingNote) && (
          <div className="mt-0.5 text-[0.82rem] leading-snug text-ink-soft">
            <InlineEdit
              key={String(editingNote)}
              value={task.note}
              multiline
              placeholder="Nota da tarefa…"
              label="Nota da tarefa"
              maxLength={LIMITS.taskNote}
              startEditing={editingNote}
              onDone={() => setEditingNote(false)}
              onSave={(note) => a.updateTask(task.id, { note })}
              voice="Ditar nota"
              viewClassName="block line-clamp-2"
            />
          </div>
        )}
      </div>
      <Menu label="Ações da tarefa" quiet onClose={() => setMenu('actions')}>
        {(close) =>
          menu === 'status' ? (
            <StatusOptions task={task} statuses={statuses} onDone={close} />
          ) : (
            <>
              <MenuItem icon={ArrowUp} disabled={i <= 0} onClick={() => (a.moveTask(siblings, task.id, -1), close())}>
                Subir
              </MenuItem>
              <MenuItem icon={ArrowDown} disabled={i >= siblings.length - 1} onClick={() => (a.moveTask(siblings, task.id, 1), close())}>
                Descer
              </MenuItem>
              <MenuItem icon={CircleDot} onClick={() => setMenu('status')}>
                Status{status ? `: ${status.name}` : ''}
              </MenuItem>
              <MenuItem icon={StickyNote} onClick={() => (setEditingNote(true), close())}>
                {task.note ? 'Editar nota' : 'Adicionar nota'}
              </MenuItem>
              <MenuItem icon={Trash2} danger onClick={() => (a.deleteTask(task.id), close())}>
                Deletar tarefa
              </MenuItem>
            </>
          )
        }
      </Menu>
    </div>
  )
}

export function NewTaskInput({ section }: { section: Section }) {
  const a = useActions()
  const [text, setText] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    a.addTask(section, v)
    setText('')
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2.5 border-t border-line py-1.5 pl-1">
      <Plus size={19} aria-hidden className="shrink-0 text-ink-soft" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={LIMITS.task}
        placeholder="Nova tarefa…"
        autoComplete="off"
        aria-label="Nova tarefa"
        className="min-w-0 flex-1 bg-transparent rounded-md py-1.5 text-[0.92rem] placeholder:text-ink-soft"
      />
      <VoiceButton value={text} onChange={setText} />
    </form>
  )
}

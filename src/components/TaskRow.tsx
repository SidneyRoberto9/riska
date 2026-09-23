import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { LIMITS, type Section, type Task } from '#/lib/types'
import { InlineEdit } from './InlineEdit'
import { Menu, MenuItem } from './Popover'
import { VoiceButton } from './VoiceButton'

export function TaskRow({ task, siblings }: { task: Task; siblings: Task[] }) {
  const a = useActions()
  const i = siblings.findIndex((t) => t.id === task.id)

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
      </div>
      <Menu label="Ações da tarefa" quiet>
        {(close) => (
          <>
            <MenuItem icon={ArrowUp} disabled={i <= 0} onClick={() => (a.moveTask(siblings, task.id, -1), close())}>
              Subir
            </MenuItem>
            <MenuItem icon={ArrowDown} disabled={i >= siblings.length - 1} onClick={() => (a.moveTask(siblings, task.id, 1), close())}>
              Descer
            </MenuItem>
            <MenuItem icon={Trash2} danger onClick={() => (a.deleteTask(task.id), close())}>
              Deletar tarefa
            </MenuItem>
          </>
        )}
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

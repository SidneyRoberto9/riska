import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { LIMITS, type Badge, type Section, type Task } from '#/lib/types'
import { BadgeChip, BadgeEditor } from './Badge'
import { InlineEdit } from './InlineEdit'
import { Menu, MenuItem, Popover } from './Popover'
import { VoiceButton } from './VoiceButton'

export function TaskRow({ task, siblings }: { task: Task; siblings: Task[] }) {
  const a = useActions()
  const [addingBadge, setAddingBadge] = useState(false)
  const setBadges = (badges: Badge[]) => a.updateTask(task.id, { badges })

  return (
    <div className="flex items-start gap-2.5 border-t border-line py-2 pl-1 first:border-t-0">
      <label className="-m-3 cursor-pointer p-3">
        <input
          type="checkbox"
          className="check"
          checked={task.done}
          onChange={(e) => a.updateTask(task.id, { done: e.target.checked })}
          aria-label="Concluída"
        />
      </label>
      <div className="min-w-0 flex-1 text-[0.92rem] leading-[1.42]">
        <InlineEdit
          value={task.text}
          required
          multiline
          maxLength={LIMITS.task}
          onSave={(text) => a.updateTask(task.id, { text })}
          className={task.done ? 'text-ink-soft line-through decoration-line' : ''}
        />
        {task.badges.map((b, j) => (
          <Popover key={j} trigger={(p) => <BadgeChip {...p} badge={b} className="ml-1.5" />}>
            {(close) => (
              <BadgeEditor
                initial={b}
                onSave={(nb) => {
                  setBadges(task.badges.map((x, k) => (k === j ? nb : x)))
                  close()
                }}
                onRemove={() => {
                  setBadges(task.badges.filter((_, k) => k !== j))
                  close()
                }}
              />
            )}
          </Popover>
        ))}
      </div>
      <Menu label="Ações da tarefa">
        {(close) =>
          addingBadge ? (
            <BadgeEditor
              onSave={(b) => {
                setBadges([...task.badges, b])
                setAddingBadge(false)
                close()
              }}
            />
          ) : (
            <>
              <MenuItem onClick={() => (a.moveTask(siblings, task.id, -1), close())}>↑ Subir</MenuItem>
              <MenuItem onClick={() => (a.moveTask(siblings, task.id, 1), close())}>↓ Descer</MenuItem>
              {task.badges.length < LIMITS.badges && <MenuItem onClick={() => setAddingBadge(true)}>＋ Badge</MenuItem>}
              <MenuItem danger onClick={() => (a.deleteTask(task.id), close())}>
                Deletar
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
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-line py-1.5 pl-[33px]">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={LIMITS.task}
        placeholder="+ nova tarefa"
        aria-label="Nova tarefa"
        className="min-w-0 flex-1 bg-transparent py-1.5 text-[0.92rem] outline-none placeholder:text-ink-soft"
      />
      <VoiceButton value={text} onChange={setText} />
    </form>
  )
}

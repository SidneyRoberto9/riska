import { useState } from 'react'
import { useActions } from '#/data/actions'
import { LIMITS, type Section, type Task } from '#/lib/types'
import { InlineEdit } from './InlineEdit'
import { Menu, MenuItem } from './Popover'
import { NewTaskInput, TaskRow } from './TaskRow'

export function SectionCard({
  section,
  index,
  siblings,
  tasks,
}: {
  section: Section
  index: number
  siblings: Section[]
  tasks: Task[]
}) {
  const a = useActions()
  const [editingNote, setEditingNote] = useState(false)

  return (
    <section
      className={`mb-3.5 rounded-2xl border px-[18px] pt-[18px] pb-2 ${
        section.highlight ? 'border-transparent bg-warn-soft' : 'border-line bg-surface'
      }`}
    >
      <div className="mb-2.5 flex items-baseline gap-2">
        <span className={`font-display text-[0.85rem] font-extrabold ${section.highlight ? 'text-warn' : 'text-accent'}`}>
          {index + 1}
        </span>
        <h2 className="m-0 min-w-0 flex-1 text-[1.02rem] font-bold">
          <InlineEdit
            value={section.title}
            required
            maxLength={LIMITS.title}
            onSave={(title) => a.updateSection(section.id, { title })}
          />
        </h2>
        <Menu label="Ações da seção">
          {(close) => (
            <>
              <MenuItem onClick={() => (a.moveSection(siblings, section.id, -1), close())}>↑ Subir</MenuItem>
              <MenuItem onClick={() => (a.moveSection(siblings, section.id, 1), close())}>↓ Descer</MenuItem>
              <MenuItem onClick={() => (a.updateSection(section.id, { highlight: !section.highlight }), close())}>
                {section.highlight ? 'Remover destaque' : 'Destacar'}
              </MenuItem>
              <MenuItem onClick={() => (setEditingNote(true), close())}>{section.note ? 'Editar nota' : 'Adicionar nota'}</MenuItem>
              <MenuItem
                danger
                onClick={() => {
                  close()
                  if (confirm(`Deletar a seção "${section.title}" e suas tarefas?`)) a.deleteSection(section.id)
                }}
              >
                Deletar
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
      {(section.note || editingNote) && (
        <div className="-mt-1 mb-2.5 text-[0.82rem] text-ink-soft">
          <InlineEdit
            key={String(editingNote)}
            value={section.note}
            multiline
            placeholder="Nota da seção"
            maxLength={LIMITS.note}
            startEditing={editingNote}
            onDone={() => setEditingNote(false)}
            onSave={(note) => a.updateSection(section.id, { note })}
          />
        </div>
      )}
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} siblings={tasks} />
      ))}
      <NewTaskInput section={section} />
    </section>
  )
}

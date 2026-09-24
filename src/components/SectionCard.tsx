import { ArrowDown, ArrowUp, GripVertical, Highlighter, StickyNote, Trash2 } from "lucide-react"
import { useState } from "react"
import { useActions } from "#/data/actions"
import { LIMITS, type Section, type Status, type Task } from "#/lib/types"
import { ColumnItems } from "./ColumnItems"
import { useSortableColumn } from "./dnd"
import { InlineEdit } from "./InlineEdit"
import { Menu } from "./Menu"
import { MenuItem } from "./MenuItem"
import { NewTaskButton } from "./NewTaskButton"
import type { NewTaskTarget } from "./TaskCreateDialog"
import { TaskRow } from "./TaskRow"

export function SectionCard({
  section,
  index,
  siblings,
  taskById,
  statuses,
  onNew,
}: {
  section: Section
  index: number
  siblings: Section[]
  taskById: Map<string, Task>
  statuses: Status[]
  onNew: (target: NewTaskTarget) => void
}) {
  const a = useActions()
  const [editingNote, setEditingNote] = useState(false)
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableColumn(section.id)
  const i = siblings.findIndex((s) => s.id === section.id)

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`mb-3.5 rounded-2xl border px-[18px] pt-[18px] pb-2 ${
        section.highlight ? "border-transparent bg-warn-soft" : "border-line bg-surface"
      } ${isDragging ? "drag-ghost" : ""}`}
    >
      <div className="group mb-2.5 flex items-baseline gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar seção: ${section.title}`}
          className="drag-handle -ml-3 grid size-7 shrink-0 cursor-grab touch-none place-items-center self-center rounded-md text-ink-soft"
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <span
          className={`font-display text-[0.85rem] font-extrabold ${section.highlight ? "text-warn" : "text-accent"}`}
        >
          {index + 1}
        </span>
        <h2 className="m-0 min-w-0 flex-1 text-[1.02rem] font-bold">
          <InlineEdit
            value={section.title}
            required
            maxLength={LIMITS.title}
            label="Título da seção"
            onSave={(title) => a.updateSection(section.id, { title })}
          />
        </h2>
        <Menu label="Ações da seção">
          {(close) => (
            <>
              <MenuItem
                icon={ArrowUp}
                disabled={i <= 0}
                onClick={() => {
                  a.moveSection(siblings, section.id, -1)
                  close()
                }}
              >
                Subir
              </MenuItem>
              <MenuItem
                icon={ArrowDown}
                disabled={i >= siblings.length - 1}
                onClick={() => {
                  a.moveSection(siblings, section.id, 1)
                  close()
                }}
              >
                Descer
              </MenuItem>
              <MenuItem
                icon={Highlighter}
                onClick={() => {
                  a.updateSection(section.id, { highlight: !section.highlight })
                  close()
                }}
              >
                {section.highlight ? "Remover destaque" : "Destacar"}
              </MenuItem>
              <MenuItem
                icon={StickyNote}
                onClick={() => {
                  setEditingNote(true)
                  close()
                }}
              >
                {section.note ? "Editar nota" : "Adicionar nota"}
              </MenuItem>
              <MenuItem
                icon={Trash2}
                danger
                onClick={() => {
                  close()
                  if (confirm(`Deletar a seção “${section.title}” e suas tarefas?`)) {
                    a.deleteSection(section.id)
                  }
                }}
              >
                Deletar seção
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
            placeholder="Nota da seção…"
            label="Nota da seção"
            maxLength={LIMITS.note}
            startEditing={editingNote}
            onDone={() => setEditingNote(false)}
            onSave={(note) => a.updateSection(section.id, { note })}
          />
        </div>
      )}
      <ColumnItems id={section.id}>
        {(ids) => {
          const tasks = ids.flatMap((id) => taskById.get(id) ?? [])
          return (
            <>
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} siblings={tasks} statuses={statuses} />
              ))}
              <NewTaskButton onClick={() => onNew({ sectionId: section.id })} />
            </>
          )
        }}
      </ColumnItems>
    </section>
  )
}

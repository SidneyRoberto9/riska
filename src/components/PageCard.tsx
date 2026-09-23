import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react"
import { useActions } from "#/data/actions"
import { useSource } from "#/data/source-context"
import type { Page } from "#/lib/types"
import { useSortableItem } from "./dnd"
import { Menu } from "./Menu"
import { MenuItem } from "./MenuItem"
import { PageLink } from "./PageLink"
import { ProgressBar } from "./ProgressBar"

export function PageCard({
  page: p,
  stats: s,
  pages,
}: {
  page: Page
  stats: { done: number; total: number }
  pages: Page[]
}) {
  const source = useSource()
  const a = useActions()
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableItem(
    p.id,
    "página arrastável"
  )
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 rounded-2xl border border-line bg-surface p-4 pl-2 ${isDragging ? "drag-ghost" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastar página: ${p.title}`}
        className="drag-handle grid h-7 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-soft"
      >
        <GripVertical size={16} aria-hidden />
      </button>
      <PageLink source={source} pageId={p.id} className="min-w-0 flex-1">
        <h2 className="m-0 text-[1.02rem] font-bold">{p.title}</h2>
        {p.subtitle && <p className="m-0 mt-0.5 truncate text-[0.82rem] text-ink-soft">{p.subtitle}</p>}
        <div className="mt-3">
          <ProgressBar small done={s.done} total={s.total} />
        </div>
      </PageLink>
      <Menu label="Ações da página">
        {(close) => (
          <>
            <MenuItem
              icon={ArrowUp}
              onClick={() => {
                a.movePage(pages, p.id, -1)
                close()
              }}
            >
              Subir
            </MenuItem>
            <MenuItem
              icon={ArrowDown}
              onClick={() => {
                a.movePage(pages, p.id, 1)
                close()
              }}
            >
              Descer
            </MenuItem>
            <MenuItem
              icon={Trash2}
              danger
              onClick={() => {
                close()
                if (confirm(`Deletar a página “${p.title}”?`)) {
                  a.deletePage(p.id)
                }
              }}
            >
              Deletar
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  )
}

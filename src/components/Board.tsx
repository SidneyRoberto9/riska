import { useActions } from "#/data/actions"
import { useSetPageSearch } from "#/data/page-search"
import { statusOf } from "#/lib/status"
import type { Section, Status, Task } from "#/lib/types"
import { BoardCardFace } from "./BoardCardFace"
import { BoardColumn } from "./BoardColumn"
import { BoardNewColumn } from "./BoardNewColumn"
import { DragPreview } from "./DragPreview"
import { SortableBoard } from "./SortableBoard"
import { SortableColumns } from "./SortableColumns"
import { useDragScroll } from "./useDragScroll"

export function Board({
  pageId,
  statuses,
  sections,
  tasks,
  onOpen,
}: {
  pageId: string
  statuses: Status[]
  sections: Section[]
  tasks: Task[]
  onOpen: (taskId: string) => void
}) {
  const a = useActions()
  const setSearch = useSetPageSearch()
  const scroller = useDragScroll<HTMLDivElement>()

  if (!sections.length) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-line p-8 text-center">
        <p className="m-0 font-semibold">Nenhuma seção ainda</p>
        <p className="m-0 mt-1 text-sm text-ink-soft">
          O quadro organiza as tarefas das seções. Crie uma seção na lista primeiro.
        </p>
        <button
          type="button"
          onClick={() => setSearch({ view: undefined })}
          className="mt-4 min-h-10 rounded-xl bg-accent px-4 font-semibold text-surface"
        >
          Ir para a lista
        </button>
      </div>
    )
  }

  const byId = new Map(tasks.map((t) => [t.id, t]))
  const statusById = new Map(statuses.map((s) => [s.id, s]))
  const columns = statuses.map((s) => ({ id: s.id, items: [] as string[] }))
  const column = new Map(columns.map((c) => [c.id, c]))
  for (const t of [...tasks].sort(
    (x, y) => x.boardPosition - y.boardPosition || x.position - y.position || x.id.localeCompare(y.id)
  )) {
    const s = statusOf(t, statuses)
    if (s) {
      column.get(s.id)?.items.push(t.id)
    }
  }
  // Section names on cards only help when there is more than one section
  const sectionTitle = sections.length > 1 ? new Map(sections.map((s) => [s.id, s.title])) : null

  return (
    <SortableBoard
      axis="x"
      columns={columns}
      onItemsCommit={({ id, from, to, order }) => {
        const status = statusById.get(to)
        a.reorderBoard(order, from !== to && status ? { id, status } : undefined)
      }}
      onColumnsCommit={a.reorderStatuses}
      label={(kind, id) =>
        kind === "item" ? `tarefa “${byId.get(id)?.text ?? ""}”` : `coluna “${statusById.get(id)?.name ?? ""}”`
      }
      renderOverlay={(kind, id) => {
        const t = byId.get(id)
        if (kind === "item") {
          return t && <BoardCardFace task={t} sectionTitle={sectionTitle?.get(t.sectionId)} />
        }
        return <DragPreview strong>{statusById.get(id)?.name}</DragPreview>
      }}
    >
      <div
        ref={scroller.ref}
        data-more-start={scroller.edges.start || undefined}
        data-more-end={scroller.edges.end || undefined}
        className={`board-scroll -mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-4 px-4 pb-6 sm:-mx-6 sm:snap-none sm:px-6 ${
          scroller.panning ? "cursor-grabbing select-none" : scroller.scrollable ? "cursor-grab" : ""
        }`}
      >
        <SortableColumns>
          {(ids) =>
            ids.map((id) => {
              const s = statusById.get(id)
              return (
                s && (
                  <BoardColumn
                    key={id}
                    status={s}
                    statuses={statuses}
                    sections={sections}
                    byId={byId}
                    sectionTitle={sectionTitle}
                    onOpen={onOpen}
                  />
                )
              )
            })
          }
        </SortableColumns>
        <BoardNewColumn pageId={pageId} />
      </div>
    </SortableBoard>
  )
}

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { type ReactNode, useContext } from "react"
import { ColumnCtx, Ctx, type Data } from "./dnd"

export const useColumnItems = (id: string) => useContext(Ctx).items[id] ?? []

// A column's items plus a droppable area (so empty columns accept drops)
export function ColumnItems({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: (ids: string[]) => ReactNode
}) {
  const ids = useColumnItems(id)
  const { setNodeRef } = useDroppable({ id: `drop:${id}`, data: { kind: "drop", column: id } satisfies Data })
  return (
    <ColumnCtx.Provider value={id}>
      <SortableContext id={id} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={className}>
          {children(ids)}
        </div>
      </SortableContext>
    </ColumnCtx.Provider>
  )
}

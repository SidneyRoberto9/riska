import { horizontalListSortingStrategy, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { type ReactNode, useContext } from "react"
import { Ctx } from "./dnd"

export function SortableColumns({ children }: { children: (ids: string[]) => ReactNode }) {
  const { columns, axis } = useContext(Ctx)
  return (
    <SortableContext
      items={columns}
      strategy={axis === "x" ? horizontalListSortingStrategy : verticalListSortingStrategy}
    >
      {children(columns)}
    </SortableContext>
  )
}

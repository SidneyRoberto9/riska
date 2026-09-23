import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { createContext, type SyntheticEvent, useContext } from "react"

export type Kind = "item" | "column"

export type Cols = Record<string, string[]>

export type Data = { kind: Kind | "drop"; column?: string }

export const Ctx = createContext<{ items: Cols; columns: string[]; axis: "x" | "y"; dragging: boolean }>({
  items: {},
  columns: [],
  axis: "y",
  dragging: false,
})

export const ColumnCtx = createContext("")

let lastDrop = 0
export const markDrop = () => {
  lastDrop = performance.now()
}

const withStyle = (s: ReturnType<typeof useSortable>) => ({
  ...s,
  style: { transform: CSS.Translate.toString(s.transform), transition: s.transition },
})

export function useSortableItem(id: string, roleDescription = "item arrastável") {
  const column = useContext(ColumnCtx)
  return withStyle(useSortable({ id, data: { kind: "item", column } satisfies Data, attributes: { roleDescription } }))
}

export function useSortableColumn(id: string) {
  return withStyle(
    useSortable({ id, data: { kind: "column" } satisfies Data, attributes: { roleDescription: "coluna arrastável" } })
  )
}

type Listeners = ReturnType<typeof useSortable>["listeners"]

// Pointer drags from anywhere in the element except its own controls (inputs and [data-no-drag])
export function dragFrom(listeners: Listeners) {
  const out: Record<string, (e: SyntheticEvent) => void> = {}
  for (const [name, fn] of Object.entries(listeners ?? {})) {
    out[name] = (e) => {
      if (name !== "onKeyDown" && (e.target as Element).closest("input, textarea, select, [data-no-drag]")) {
        return
      }
      ;(fn as (e: SyntheticEvent) => void)(e)
    }
  }
  return out
}

// True while dragging and right after a drop: the click that ends a mouse drag (or the Space that lifts a card)
// must not also "click" what was dragged
export function useClickGuard() {
  const { dragging } = useContext(Ctx)
  return () => dragging || performance.now() - lastDrop < 250
}

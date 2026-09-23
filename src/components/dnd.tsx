import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'

export type Kind = 'item' | 'column'
type Cols = Record<string, string[]>
type Data = { kind: Kind | 'drop'; column?: string }
type WithData = { id: string | number; data: { current?: unknown } }

const Ctx = createContext<{ items: Cols; columns: string[]; axis: 'x' | 'y'; dragging: boolean }>({
  items: {},
  columns: [],
  axis: 'y',
  dragging: false,
})
const ColumnCtx = createContext('')

let lastDrop = 0
const dataOf = (x: WithData | null | undefined) => x?.data.current as Data | undefined
const findColumn = (cols: Cols, id: string) => Object.keys(cols).find((k) => cols[k].includes(id))
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Columns only collide with columns; items with items or a column's empty area. Pointer first (mouse/touch),
// then the closest item inside the hovered column; keyboard has no pointer and falls back to closestCorners.
const collision: CollisionDetection = (args) => {
  const kind = dataOf(args.active)?.kind
  const targets = args.droppableContainers.filter((c) => {
    const k = dataOf(c)?.kind
    return kind === 'column' ? k === 'column' : k === 'item' || k === 'drop'
  })
  const scoped = { ...args, droppableContainers: targets }
  if (kind === 'column') return closestCenter(scoped)
  const hits = pointerWithin(scoped)
  const onItem = hits.filter((h) => dataOf(targets.find((c) => c.id === h.id))?.kind === 'item')
  if (onItem.length) return onItem
  if (hits.length) {
    const column = dataOf(targets.find((c) => c.id === hits[0].id))?.column
    const inColumn = targets.filter((c) => dataOf(c)?.kind === 'item' && dataOf(c)?.column === column)
    return inColumn.length ? closestCenter({ ...args, droppableContainers: inColumn }) : hits
  }
  return closestCorners(scoped)
}

// Arrow keys only step between droppables of the dragged kind: a section jumps section to section, not task to task
const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { context } = args
  const all = context.droppableContainers
  const column = dataOf(context.active)?.kind === 'column'
  const Scoped = all.constructor as new (entries: typeof all extends Map<infer K, infer V> ? [K, V][] : never) => typeof all
  const scoped = new Scoped([...all].filter(([, c]) => (dataOf(c)?.kind === 'column') === column))
  return sortableKeyboardCoordinates(event, { ...args, context: { ...context, droppableContainers: scoped } })
}

export function SortableBoard({
  columns,
  axis = 'y',
  onItemsCommit,
  onColumnsCommit,
  renderOverlay,
  label,
  children,
}: {
  columns: { id: string; items: string[] }[]
  axis?: 'x' | 'y'
  /** `order` is the destination column's final order; `from !== to` when the item changed column */
  onItemsCommit: (move: { id: string; from: string; to: string; order: string[] }) => void
  onColumnsCommit?: (order: string[]) => void
  renderOverlay: (kind: Kind, id: string) => ReactNode
  /** Accessible name for announcements, lowercase: `tarefa “Pão”`, `seção “Hoje”` */
  label: (kind: Kind, id: string) => string
  children: ReactNode
}) {
  const live: Cols = Object.fromEntries(columns.map((c) => [c.id, c.items]))
  const liveColumns = columns.map((c) => c.id)
  const liveKey = JSON.stringify(columns)
  const [active, setActive] = useState<{ kind: Kind; id: string; from: string } | null>(null)
  const [order, setOrder] = useState<{ items: Cols; columns: string[] } | null>(null)
  const settling = useRef(false)

  // After a drop the final order stays on screen until the optimistic write reaches the live data (no snap-back)
  useEffect(() => {
    if (!settling.current) return
    settling.current = false
    setOrder(null)
  }, [liveKey])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Long-press on cards so scrolling still works; handles start immediately
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
      bypassActivationConstraint: ({ event }) => !!(event.target as Element | null)?.closest?.('.drag-handle'),
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )

  const items = order?.items ?? live
  const cols = order?.columns ?? liveColumns
  const kindOf = (x: WithData): Kind => (dataOf(x)?.kind === 'column' ? 'column' : 'item')
  const who = (x: WithData) => label(kindOf(x), String(x.id))
  const where = (x: WithData) => {
    const d = dataOf(x)
    return d?.kind === 'drop' ? label('column', d.column ?? '') : who(x)
  }
  // Where the dragged element lands if dropped on `over`: "posição i de n" within its column (or among columns)
  const position = (a: WithData, over: WithData) => {
    const id = String(a.id)
    const overId = String(over.id)
    const d = dataOf(over)
    if (kindOf(a) === 'column') {
      const i = cols.indexOf(overId)
      return `posição ${(i < 0 ? cols.indexOf(id) : i) + 1} de ${cols.length}`
    }
    const list = items[(d?.kind === 'drop' ? d.column : findColumn(items, overId)) ?? ''] ?? []
    const n = list.includes(id) ? list.length : list.length + 1
    const i = d?.kind === 'drop' ? (list.includes(id) ? list.indexOf(id) + 1 : n) : list.indexOf(overId) + 1
    return `posição ${i} de ${n}`
  }
  const target = (a: WithData, over: WithData) =>
    over.id === a.id ? `na ${position(a, over)}` : `sobre ${where(over)}, ${position(a, over)}`
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${cap(who(active))} levantada.`,
    onDragOver: ({ active, over }) => (over ? `${cap(who(active))} ${target(active, over)}.` : `${cap(who(active))} fora de uma área válida.`),
    onDragEnd: ({ active, over }) => (over ? `${cap(who(active))} solta ${target(active, over)}.` : `${cap(who(active))} solta.`),
    onDragCancel: ({ active }) => `Movimento cancelado. ${cap(who(active))} voltou ao lugar.`,
  }

  const reset = () => {
    lastDrop = performance.now()
    setActive(null)
  }
  // Show the final order, write it optimistically, then drop local state once the live data catches up
  const settle = (final: { items: Cols; columns: string[] } | null, commit?: () => void) => {
    if (!final || !commit) return setOrder(null)
    setOrder(final)
    settling.current = true
    commit()
    setTimeout(() => {
      if (!settling.current) return
      settling.current = false
      setOrder(null)
    }, 1000)
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id)
    setActive({ kind: kindOf(active), id, from: findColumn(live, id) ?? '' })
    setOrder({ items: live, columns: liveColumns })
  }

  // Moving between columns happens live while hovering; reordering inside a column is the sortable strategy's preview
  const onDragOver = ({ active: a, over }: DragOverEvent) => {
    const d = dataOf(over)
    if (!over || !d || kindOf(a) !== 'item') return
    const id = String(a.id)
    setOrder((prev) => {
      if (!prev) return prev
      const from = findColumn(prev.items, id)
      const to = d.kind === 'drop' ? d.column : findColumn(prev.items, String(over.id))
      if (!from || !to || from === to) return prev
      const target = prev.items[to].filter((x) => x !== id)
      const overIndex = target.indexOf(String(over.id))
      const rect = a.rect.current.translated
      const below = !!rect && rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2
      const at = overIndex < 0 ? target.length : overIndex + (below ? 1 : 0)
      const next = { ...prev.items, [from]: prev.items[from].filter((x) => x !== id), [to]: [...target.slice(0, at), id, ...target.slice(at)] }
      return { ...prev, items: next }
    })
  }

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    const id = String(a.id)
    const drag = active
    reset()
    if (!drag || !order) return settle(null)
    const overId = over ? String(over.id) : null

    if (drag.kind === 'column') {
      const next = overId && overId !== id && order.columns.includes(overId)
        ? arrayMove(order.columns, order.columns.indexOf(id), order.columns.indexOf(overId))
        : order.columns
      if (next.join() === liveColumns.join() || !onColumnsCommit) return settle(null)
      return settle({ ...order, columns: next }, () => onColumnsCommit(next))
    }

    const to = findColumn(order.items, id)
    if (!over || !to) return settle(null)
    let list = order.items[to]
    if (overId && overId !== id && list.includes(overId)) list = arrayMove(list, list.indexOf(id), list.indexOf(overId))
    if (to === drag.from && list.join() === (live[to] ?? []).join()) return settle(null)
    settle({ ...order, items: { ...order.items, [to]: list } }, () => onItemsCommit({ id, from: drag.from, to, order: list }))
  }

  const onDragCancel = () => {
    reset()
    settle(null)
  }

  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Para mover, pressione espaço. Use as setas para escolher o lugar, espaço para soltar ou Esc para cancelar.',
        },
      }}
    >
      <Ctx.Provider value={{ items, columns: cols, axis, dragging: !!active }}>{children}</Ctx.Provider>
      <DragOverlay dropAnimation={reduced ? null : { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {/* dnd-kit measures the overlay's first child: keep the lift's rotate/scale off it, or the enlarged rect
            makes the keyboard's first ↓ land on the dragged item itself */}
        {active && (
          <div>
            <div className="drag-lift">{renderOverlay(active.kind, active.id)}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

export function SortableColumns({ children }: { children: (ids: string[]) => ReactNode }) {
  const { columns, axis } = useContext(Ctx)
  return (
    <SortableContext items={columns} strategy={axis === 'x' ? horizontalListSortingStrategy : verticalListSortingStrategy}>
      {children(columns)}
    </SortableContext>
  )
}

export const useColumnItems = (id: string) => useContext(Ctx).items[id] ?? []

// A column's items plus a droppable area (so empty columns accept drops)
export function ColumnItems({ id, className, children }: { id: string; className?: string; children: (ids: string[]) => ReactNode }) {
  const ids = useColumnItems(id)
  const { setNodeRef } = useDroppable({ id: `drop:${id}`, data: { kind: 'drop', column: id } satisfies Data })
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

const withStyle = (s: ReturnType<typeof useSortable>) => ({
  ...s,
  style: { transform: CSS.Translate.toString(s.transform), transition: s.transition },
})

export function useSortableItem(id: string, roleDescription = 'item arrastável') {
  const column = useContext(ColumnCtx)
  return withStyle(useSortable({ id, data: { kind: 'item', column } satisfies Data, attributes: { roleDescription } }))
}

export function useSortableColumn(id: string) {
  return withStyle(useSortable({ id, data: { kind: 'column' } satisfies Data, attributes: { roleDescription: 'coluna arrastável' } }))
}

type Listeners = ReturnType<typeof useSortable>['listeners']

// Pointer drags from anywhere in the element except its own controls (inputs and [data-no-drag])
export function dragFrom(listeners: Listeners) {
  const out: Record<string, (e: SyntheticEvent) => void> = {}
  for (const [name, fn] of Object.entries(listeners ?? {})) {
    out[name] = (e) => {
      if (name !== 'onKeyDown' && (e.target as Element).closest('input, textarea, select, [data-no-drag]')) return
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

export function DragPreview({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <div className={`rounded-xl border border-line bg-surface px-3 py-2 text-[0.92rem] ${strong ? 'font-display font-bold' : ''}`}>{children}</div>
  )
}

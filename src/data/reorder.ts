import type { Collection } from "@tanstack/react-db"
import { renumber } from "#/lib/order"

type Row = { id: string }

// Writes 1..n into `field` for `ids` (only rows that change) plus per-row extra changes:
// one optimistic transaction = one server call, so a drop never half-applies
export function reorderTx<T extends Row>(
  c: Collection<T, string>,
  ids: string[],
  field: keyof T & string,
  extra: Record<string, Partial<T>> = {}
) {
  const pos = renumber(ids, new Map(ids.map((id) => [id, Number(c.get(id)?.[field])])))
  const keys = [...new Set([...pos.keys(), ...Object.keys(extra)])].filter((id) => c.has(id))
  if (!keys.length) {
    return null
  }
  return c.update(keys, (drafts) => {
    drafts.forEach((d, i) => {
      const p = pos.get(keys[i])
      if (p !== undefined) {
        Object.assign(d, { [field]: p })
      }
      Object.assign(d, extra[keys[i]])
    })
  })
}

type Positioned = { position: number }

export const nextPosition = (items: Positioned[]) => items.reduce((max, x) => Math.max(max, x.position), 0) + 1

// 1-based positions for `ids` in order, only for rows whose stored position actually changes
export function renumber(ids: string[], current: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  ids.forEach((id, i) => {
    if (current.get(id) !== i + 1) out.set(id, i + 1)
  })
  return out
}

// `ids` with `id` swapped with its neighbour in `dir`; unchanged when that would leave the list
export function shift(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= ids.length) return ids
  const next = [...ids]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

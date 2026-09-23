import { ID_RE, PIN_RE, SLUG_RE } from '#/lib/id'
import { LIMITS, MODES, THEMES, type Badge } from '#/lib/types'

type Check<T> = (v: unknown) => T
type Shape = Record<string, Check<unknown>>
type Out<S extends Shape> = { [K in keyof S]: ReturnType<S[K]> }

export function invalid(): never {
  throw new Error('INVALID')
}

const obj = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : invalid()

export const str = (max: number): Check<string> => (v) =>
  typeof v === 'string' && v.length <= max ? v : invalid()
export const id: Check<string> = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : invalid())
export const slug: Check<string> = (v) => (typeof v === 'string' && SLUG_RE.test(v) ? v : invalid())
export const pin: Check<string> = (v) => (typeof v === 'string' && PIN_RE.test(v) ? v : invalid())
export const bool: Check<boolean> = (v) => (typeof v === 'boolean' ? v : invalid())
export const int: Check<number> = (v) => (Number.isSafeInteger(v) ? (v as number) : invalid())
export const oneOf = <T extends string>(list: readonly T[]): Check<T> => (v) =>
  list.includes(v as T) ? (v as T) : invalid()
export const arr = <T>(each: Check<T>, max = 500): Check<T[]> => (v) =>
  Array.isArray(v) && v.length <= max ? v.map(each) : invalid()

const color: Check<string> = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/.test(v) ? v : invalid())
export const badges: Check<Badge[]> = arr((b) => {
  const o = obj(b)
  return { text: str(LIMITS.badgeText)(o.text), color: color(o.color) }
}, LIMITS.badges)

export const theme = oneOf(THEMES.map((t) => t.id))
export const mode = oneOf(MODES.map((m) => m.id))

export function shape<S extends Shape>(s: S): Check<Out<S>> {
  return (v) => {
    const o = obj(v)
    return Object.fromEntries(Object.entries(s).map(([k, f]) => [k, f(o[k])])) as Out<S>
  }
}

export function partial<S extends Shape>(s: S): Check<Partial<Out<S>>> {
  return (v) => {
    const o = obj(v)
    const keys = Object.keys(o)
    if (!keys.length) invalid()
    return Object.fromEntries(keys.map((k) => [k, (s[k] ?? invalid)(o[k])])) as Partial<Out<S>>
  }
}

export const pageFields = { title: str(LIMITS.title), subtitle: str(LIMITS.title), position: int }
export const sectionFields = { title: str(LIMITS.title), note: str(LIMITS.note), highlight: bool, position: int }
export const taskFields = { text: str(LIMITS.task), done: bool, badges, position: int }

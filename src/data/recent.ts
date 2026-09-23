const KEY = 'checklist-recent'

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {}
}

export const rememberSession = (slug: string) => write([slug, ...readRecent().filter((s) => s !== slug)].slice(0, 10))
export const forgetSession = (slug: string) => write(readRecent().filter((s) => s !== slug))

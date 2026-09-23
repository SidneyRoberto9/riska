export const THEMES = [
  { id: 'roxo', label: 'Roxo', swatch: '#6d28d9' },
  { id: 'rosa', label: 'Rosa', swatch: '#be185d' },
  { id: 'verde', label: 'Verde', swatch: '#047857' },
  { id: 'azul', label: 'Azul', swatch: '#1d4ed8' },
  { id: 'ambar', label: 'Âmbar', swatch: '#c2410c' },
  { id: 'grafite', label: 'Grafite', swatch: '#3f3f46' },
] as const
export type ThemeId = (typeof THEMES)[number]['id']

export const MODES = [
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
  { id: 'system', label: 'Sistema' },
] as const
export type Mode = (typeof MODES)[number]['id']

export const STATUS_COLORS = ['#dc2626', '#ea580c', '#d97706', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#6b7280']

export const LIMITS = { title: 200, note: 500, task: 1000, taskNote: 2000, statusName: 30 }

export type Page = { id: string; title: string; subtitle: string; position: number }
export type Section = { id: string; pageId: string; title: string; note: string; highlight: boolean; position: number }
export type Status = { id: string; pageId: string; name: string; color: string; done: boolean; position: number }
// pageId is derived server-side from the section (not a column); kept on the client for cheap per-page filtering.
// statusId null (or pointing at a deleted status) means the page's first status. `done` is always written with statusId.
// position orders the task inside its section (Lista); boardPosition orders it inside its column (Quadro).
export type Task = {
  id: string
  sectionId: string
  pageId: string
  text: string
  done: boolean
  statusId: string | null
  note: string
  createdAt: string | null
  position: number
  boardPosition: number
}
export type Settings = { id: 'settings'; theme: ThemeId; mode: Mode }

export const DEFAULT_SETTINGS: Settings = { id: 'settings', theme: 'roxo', mode: 'system' }

export const DEFAULT_STATUSES: Pick<Status, 'name' | 'color' | 'done'>[] = [
  { name: 'A Fazer', color: '#6b7280', done: false },
  { name: 'Em Andamento', color: '#2563eb', done: false },
  { name: 'Concluído', color: '#16a34a', done: true },
]

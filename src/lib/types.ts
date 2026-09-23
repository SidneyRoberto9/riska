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

export const BADGE_COLORS = ['#dc2626', '#ea580c', '#d97706', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#6b7280']

export const LIMITS = { title: 200, note: 500, task: 1000, badges: 10, badgeText: 30 }

export type Badge = { text: string; color: string }
export type Page = { id: string; title: string; subtitle: string; position: number }
export type Section = { id: string; pageId: string; title: string; note: string; highlight: boolean; position: number }
// pageId is derived server-side from the section (not a column); kept on the client for cheap per-page filtering
export type Task = { id: string; sectionId: string; pageId: string; text: string; done: boolean; badges: Badge[]; position: number }
export type Settings = { id: 'settings'; theme: ThemeId; mode: Mode }

export const DEFAULT_SETTINGS: Settings = { id: 'settings', theme: 'roxo', mode: 'system' }

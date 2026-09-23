import { Columns3, List } from 'lucide-react'
import { useSetPageSearch, type PageSearch } from '#/data/page-search'

const OPTIONS = [
  { view: undefined, label: 'Lista', icon: List },
  { view: 'quadro', label: 'Quadro', icon: Columns3 },
] as const

export function ViewToggle({ view }: { view: PageSearch['view'] }) {
  const setSearch = useSetPageSearch()
  return (
    <fieldset className="m-0 flex shrink-0 gap-0.5 rounded-xl border border-line bg-surface p-0.5">
      <legend className="sr-only">Visualização</legend>
      {OPTIONS.map((o) => (
        <label
          key={o.label}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-ink-soft hover:text-ink has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:outline-2 has-focus-visible:outline-accent"
        >
          <input type="radio" name="view" className="sr-only" checked={view === o.view} onChange={() => setSearch({ view: o.view, task: undefined })} />
          <o.icon size={16} aria-hidden />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}

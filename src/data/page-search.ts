import { useNavigate } from "@tanstack/react-router"
import { ID_RE } from "#/lib/id"

export type PageSearch = { view?: "quadro"; task?: string }

// Shared by /s/$slug/p/$pageId and /local/p/$pageId; anything unexpected is dropped
export const validatePageSearch = (s: Record<string, unknown>): PageSearch => ({
  view: s.view === "quadro" ? "quadro" : undefined,
  task: typeof s.task === "string" && ID_RE.test(s.task) ? s.task : undefined,
})

export function useSetPageSearch() {
  const navigate = useNavigate()
  // ponytail: untyped relative navigate because one view serves two routes; type it per route if they diverge
  return (patch: PageSearch, opts: { replace?: boolean } = {}) =>
    navigate({ to: ".", search: (prev: PageSearch) => ({ ...prev, ...patch }), ...opts } as never)
}

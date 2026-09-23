import { createFileRoute } from '@tanstack/react-router'
import { ChecklistView } from '#/components/ChecklistView'
import { validatePageSearch } from '#/data/page-search'

export const Route = createFileRoute('/s/$slug/p/$pageId')({ validateSearch: validatePageSearch, component: Page })

function Page() {
  const { pageId } = Route.useParams()
  const { view, task } = Route.useSearch()
  return <ChecklistView pageId={pageId} view={view} taskId={task} />
}

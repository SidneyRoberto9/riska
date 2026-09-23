import { createFileRoute } from '@tanstack/react-router'
import { ChecklistView } from '#/components/ChecklistView'

export const Route = createFileRoute('/s/$slug/p/$pageId')({ component: Page })

function Page() {
  const { pageId } = Route.useParams()
  return <ChecklistView pageId={pageId} />
}

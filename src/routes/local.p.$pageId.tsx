import { createFileRoute } from '@tanstack/react-router'
import { ChecklistView } from '#/components/ChecklistView'

export const Route = createFileRoute('/local/p/$pageId')({ component: Page })

function Page() {
  const { pageId } = Route.useParams()
  return <ChecklistView pageId={pageId} />
}

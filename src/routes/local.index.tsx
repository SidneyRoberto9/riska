import { createFileRoute } from '@tanstack/react-router'
import { PagesView } from '#/components/PagesView'

export const Route = createFileRoute('/local/')({ component: PagesView })

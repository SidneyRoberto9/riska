import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Shell } from '#/components/Shell'
import { getLocalSource } from '#/data/source'
import { SourceContext } from '#/data/source-context'

// localStorage only exists in the browser
export const Route = createFileRoute('/local')({ ssr: false, component: LocalLayout })

function LocalLayout() {
  return (
    <SourceContext.Provider value={getLocalSource()}>
      <Shell>
        <Outlet />
      </Shell>
    </SourceContext.Provider>
  )
}

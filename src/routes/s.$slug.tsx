import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { useEffect } from 'react'
import { PinGate } from '#/components/PinGate'
import { Shell } from '#/components/Shell'
import { rememberSession } from '#/data/recent'
import { getServerSource, listFns, queryKeys } from '#/data/source'
import { SourceContext } from '#/data/source-context'
import { SLUG_RE } from '#/lib/id'
import { accessFn } from '#/server/session'

export const Route = createFileRoute('/s/$slug')({
  // Loader (access check + data prefetch) runs on the server; components render on the client,
  // where TanStack DB collections live. Prefetched queries are dehydrated into the client QueryClient.
  ssr: 'data-only',
  loader: async ({ params: { slug }, context: { queryClient } }) => {
    if (!SLUG_RE.test(slug)) throw notFound()
    const { access } = await accessFn({ data: { slug } })
    if (access) {
      const names = Object.keys(queryKeys) as (keyof typeof queryKeys)[]
      await Promise.all(
        names.map((n) =>
          queryClient.ensureQueryData({ queryKey: queryKeys[n](slug), queryFn: () => listFns[n]({ data: { slug } }) as Promise<unknown[]> }),
        ),
      )
    }
    return { access }
  },
  component: SessionLayout,
})

function SessionLayout() {
  const { slug } = Route.useParams()
  const { access } = Route.useLoaderData()
  const { queryClient } = Route.useRouteContext()

  useEffect(() => {
    if (access) rememberSession(slug)
  }, [access, slug])

  if (!access) return <PinGate slug={slug} />

  return (
    <SourceContext.Provider value={getServerSource(queryClient, slug)}>
      <Shell>
        <Outlet />
      </Shell>
    </SourceContext.Provider>
  )
}

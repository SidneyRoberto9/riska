import { createCollection, localStorageCollectionOptions, type Collection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/react-query'
import type { Page, Section, Settings, Task } from '#/lib/types'
import {
  deletePagesFn, deleteSectionsFn, deleteTasksFn, insertPagesFn, insertSectionsFn, insertTasksFn,
  listPagesFn, listSectionsFn, listTasksFn, updatePagesFn, updateSectionsFn, updateTasksFn,
} from '#/server/data'
import { getSettingsFn, updateSettingsFn } from '#/server/session'

export type Source = {
  slug: string | null
  basePath: string
  pages: Collection<Page, string>
  sections: Collection<Section, string>
  tasks: Collection<Task, string>
  settings: Collection<Settings, string>
}

type Fn<I> = (opts: { data: I }) => Promise<unknown>

// Query keys are shared with route loaders so SSR-prefetched data seeds the collections
export const queryKeys = {
  pages: (slug: string) => ['pages', slug],
  sections: (slug: string) => ['sections', slug],
  tasks: (slug: string) => ['tasks', slug],
  settings: (slug: string) => ['settings', slug],
}

export const listFns = { pages: listPagesFn, sections: listSectionsFn, tasks: listTasksFn, settings: getSettingsFn }

function serverCollection<T extends { id: string }>(
  qc: QueryClient,
  slug: string,
  name: keyof typeof queryKeys,
  fns: {
    insert?: Fn<{ slug: string; items: T[] }>
    update: Fn<{ slug: string; items: { id: string; changes: Partial<T> }[] }>
    remove?: Fn<{ slug: string; ids: string[] }>
  },
) {
  const list = listFns[name] as unknown as Fn<{ slug: string }>
  return createCollection(
    queryCollectionOptions({
      id: `${name}-${slug}`,
      queryKey: queryKeys[name](slug),
      queryFn: () => list({ data: { slug } }) as Promise<T[]>,
      queryClient: qc,
      getKey: (x: T) => x.id,
      refetchInterval: 15_000,
      onInsert: async ({ transaction }) => {
        await fns.insert?.({ data: { slug, items: transaction.mutations.map((m) => m.modified) } })
      },
      onUpdate: async ({ transaction }) => {
        await fns.update({
          data: { slug, items: transaction.mutations.map((m) => ({ id: m.key as string, changes: m.changes })) },
        })
      },
      onDelete: async ({ transaction }) => {
        await fns.remove?.({ data: { slug, ids: transaction.mutations.map((m) => m.key as string) } })
      },
    }),
  ) as unknown as Collection<T, string>
}

const serverSources = new Map<string, Source>()

export function getServerSource(qc: QueryClient, slug: string): Source {
  let source = serverSources.get(slug)
  if (!source) {
    source = {
      slug,
      basePath: `/s/${slug}`,
      pages: serverCollection<Page>(qc, slug, 'pages', { insert: insertPagesFn, update: updatePagesFn, remove: deletePagesFn }),
      sections: serverCollection<Section>(qc, slug, 'sections', { insert: insertSectionsFn, update: updateSectionsFn, remove: deleteSectionsFn }),
      tasks: serverCollection<Task>(qc, slug, 'tasks', { insert: insertTasksFn, update: updateTasksFn, remove: deleteTasksFn }),
      settings: serverCollection<Settings>(qc, slug, 'settings', {
        update: ({ data }) => updateSettingsFn({ data: { slug, changes: data.items[0].changes } }),
      }),
    }
    serverSources.set(slug, source)
  }
  return source
}

export function forgetServerSource(slug: string) {
  serverSources.delete(slug)
}

function localCollection<T extends { id: string }>(name: string) {
  return createCollection(
    localStorageCollectionOptions({ id: `local-${name}`, storageKey: `checklist-local-${name}`, getKey: (x: T) => x.id }),
  ) as unknown as Collection<T, string>
}

let localSource: Source | undefined

export function getLocalSource(): Source {
  localSource ??= {
    slug: null,
    basePath: '/local',
    pages: localCollection<Page>('pages'),
    sections: localCollection<Section>('sections'),
    tasks: localCollection<Task>('tasks'),
    settings: localCollection<Settings>('settings'),
  }
  return localSource
}

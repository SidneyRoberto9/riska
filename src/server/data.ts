import { createServerFn } from "@tanstack/react-start"
import type { Page, Section, Status, Task } from "#/lib/types"
import { requireAccess } from "./auth.server"
import { db } from "./db.server"
import {
  arr,
  id,
  pageFields,
  partial,
  sectionFields,
  shape,
  slug,
  statusFields,
  taskFields,
  taskUpdateFields,
} from "./validate"

const bySlug = shape({ slug })
const updates = <S extends Record<string, (v: unknown) => unknown>>(fields: S) =>
  shape({ slug, items: arr(shape({ id, changes: partial(fields) })) })
const removals = shape({ slug, ids: arr(id) })

// ---- reads -------------------------------------------------------------

export const listPagesFn = createServerFn()
  .validator(bySlug)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    return [
      ...(await sql<Page[]>`
      select id, title, subtitle, position from pages where session_slug = ${s}`),
    ]
  })

export const listSectionsFn = createServerFn()
  .validator(bySlug)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    return [
      ...(await sql<Section[]>`
      select s.id, s.page_id, s.title, s.note, s.highlight, s.position
      from sections s join pages p on p.id = s.page_id
      where p.session_slug = ${s}`),
    ]
  })

export const listTasksFn = createServerFn()
  .validator(bySlug)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    return [
      ...(await sql<Task[]>`
      select t.id, t.section_id, s.page_id, t.text, t.done, t.status_id, t.note,
             to_json(t.created_at) #>> '{}' as created_at, t.position, t.board_position
      from tasks t join sections s on s.id = t.section_id join pages p on p.id = s.page_id
      where p.session_slug = ${s}`),
    ]
  })

// ---- pages -------------------------------------------------------------

export const insertPagesFn = createServerFn({ method: "POST" })
  .validator(shape({ slug, items: arr(shape({ id, ...pageFields })) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`insert into pages ${sql(data.items.map((p) => ({ ...p, sessionSlug: s })))}`
  })

export const updatePagesFn = createServerFn({ method: "POST" })
  .validator(updates(pageFields))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const { id, changes } of data.items) {
        await tx`update pages set ${tx(changes as Record<string, any>)} where id = ${id} and session_slug = ${s}`
      }
    })
  })

export const deletePagesFn = createServerFn({ method: "POST" })
  .validator(removals)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`delete from pages where id = any(${data.ids}) and session_slug = ${s}`
  })

// ---- sections ----------------------------------------------------------

export const insertSectionsFn = createServerFn({ method: "POST" })
  .validator(shape({ slug, items: arr(shape({ id, pageId: id, ...sectionFields })) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const x of data.items) {
        const [ok] = await tx`select 1 from pages where id = ${x.pageId} and session_slug = ${s}`
        if (!ok) {
          throw new Error("NOT_FOUND")
        }
        await tx`insert into sections ${tx(x)}`
      }
    })
  })

export const updateSectionsFn = createServerFn({ method: "POST" })
  .validator(updates(sectionFields))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const { id, changes } of data.items) {
        await tx`update sections set ${tx(changes as Record<string, any>)}
          where id = ${id} and page_id in (select id from pages where session_slug = ${s})`
      }
    })
  })

export const deleteSectionsFn = createServerFn({ method: "POST" })
  .validator(removals)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`delete from sections where id = any(${data.ids}) and page_id in (select id from pages where session_slug = ${s})`
  })

// ---- statuses ----------------------------------------------------------

export const listStatusesFn = createServerFn()
  .validator(bySlug)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    return [
      ...(await sql<Status[]>`
      select st.id, st.page_id, st.name, st.color, st.done, st.position
      from statuses st join pages p on p.id = st.page_id
      where p.session_slug = ${s}`),
    ]
  })

export const insertStatusesFn = createServerFn({ method: "POST" })
  .validator(shape({ slug, items: arr(shape({ id, pageId: id, ...statusFields })) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const x of data.items) {
        const [ok] = await tx`select 1 from pages where id = ${x.pageId} and session_slug = ${s}`
        if (!ok) {
          throw new Error("NOT_FOUND")
        }
        await tx`insert into statuses ${tx(x)}`
      }
    })
  })

export const updateStatusesFn = createServerFn({ method: "POST" })
  .validator(updates(statusFields))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const { id, changes } of data.items) {
        await tx`update statuses set ${tx(changes as Record<string, any>)}
          where id = ${id} and page_id in (select id from pages where session_slug = ${s})`
      }
    })
  })

export const deleteStatusesFn = createServerFn({ method: "POST" })
  .validator(removals)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`delete from statuses where id = any(${data.ids}) and page_id in (select id from pages where session_slug = ${s})`
  })

// ---- tasks -------------------------------------------------------------

export const insertTasksFn = createServerFn({ method: "POST" })
  .validator(shape({ slug, items: arr(shape({ id, sectionId: id, ...taskFields })) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const x of data.items) {
        // Section in this session; a status, when set, must belong to that section's page
        const [ok] = await tx`
          select 1 from sections sc join pages p on p.id = sc.page_id
          where sc.id = ${x.sectionId} and p.session_slug = ${s}
            and (${x.statusId}::text is null
                 or exists (select 1 from statuses st where st.id = ${x.statusId} and st.page_id = sc.page_id))`
        if (!ok) {
          throw new Error("NOT_FOUND")
        }
        await tx`insert into tasks ${tx(x)}`
      }
    })
  })

export const updateTasksFn = createServerFn({ method: "POST" })
  .validator(updates(taskUpdateFields))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const { id, changes } of data.items) {
        const sectionId = changes.sectionId ?? null
        const statusId = changes.statusId ?? null
        // The (possibly new) section must be in this session and a new status must be on that section's page;
        // otherwise nothing is written (same as updating a row another device already deleted)
        await tx`update tasks t set ${tx(changes as Record<string, any>)}
          from sections sc join pages p on p.id = sc.page_id
          where t.id = ${id} and sc.id = coalesce(${sectionId}::text, t.section_id) and p.session_slug = ${s}
            and (${statusId}::text is null
                 or exists (select 1 from statuses st where st.id = ${statusId} and st.page_id = sc.page_id))`
      }
    })
  })

export const deleteTasksFn = createServerFn({ method: "POST" })
  .validator(removals)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`delete from tasks where id = any(${data.ids}) and section_id in (select sc.id from sections sc join pages p on p.id = sc.page_id where p.session_slug = ${s})`
  })

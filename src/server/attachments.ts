import { createServerFn } from "@tanstack/react-start"
import { newId } from "#/lib/id"
import { checkImage, MAX_IMAGES_PER_TASK } from "#/lib/images"
import type { Attachment } from "#/lib/types"
import { requireAccess } from "./auth.server"
import { db } from "./db.server"
import { deleteObject, headObject, objectKey, presignPut, storageEnabled } from "./storage.server"
import { arr, attachmentFields, id, imageType, int, invalid, shape, slug } from "./validate"

export const storageEnabledFn = createServerFn().handler(async () => storageEnabled())

export const listAttachmentsFn = createServerFn()
  .validator(shape({ slug }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    return [
      ...(await sql<Attachment[]>`
      select a.id, a.task_id, sc.page_id, a.name, a.content_type, a.size, a.position
      from attachments a join tasks t on t.id = a.task_id join sections sc on sc.id = t.section_id
        join pages p on p.id = sc.page_id
      where p.session_slug = ${s}`),
    ]
  })

// The object key is derived from the session and a server-made id, so a client can only ever write under its own slug
export const createUploadFn = createServerFn({ method: "POST" })
  .validator(shape({ slug, contentType: imageType, size: int }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    if (checkImage(data.contentType, data.size)) {
      invalid()
    }
    const attachmentId = newId()
    return { id: attachmentId, url: await presignPut(objectKey(s, attachmentId), data.contentType, data.size) }
  })

export const insertAttachmentsFn = createServerFn({ method: "POST" })
  .validator(shape({ slug, items: arr(shape({ id, taskId: id, ...attachmentFields }), MAX_IMAGES_PER_TASK) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const x of data.items) {
        // Lock the task row so concurrent inserts can't both pass the per-task limit
        const [task] = await tx`
          select t.id from tasks t join sections sc on sc.id = t.section_id join pages p on p.id = sc.page_id
          where t.id = ${x.taskId} and p.session_slug = ${s} for update of t`
        if (!task) {
          throw new Error("NOT_FOUND")
        }
        const [{ n }] = await tx<
          { n: number }[]
        >`select count(*)::int as n from attachments where task_id = ${x.taskId}`
        if (n >= MAX_IMAGES_PER_TASK) {
          throw new Error("TOO_MANY")
        }
        // Trust the stored object, not the client's claim: it must exist and be an allowed image within the size limit
        const key = objectKey(s, x.id)
        const head = await headObject(key)
        if (!head || checkImage(head.contentType, head.size)) {
          if (head) {
            await deleteObject(key)
          }
          throw new Error("INVALID_IMAGE")
        }
        await tx`insert into attachments ${tx({
          id: x.id,
          taskId: x.taskId,
          key,
          name: x.name,
          contentType: head.contentType,
          size: head.size,
          position: x.position,
        })}`
      }
    })
  })

// ponytail: rows only — R2 objects of removed images (and of deleted tasks/pages/sessions) are left behind;
// add a sweep that lists `<slug>/` prefixes against `attachments.key` when storage cost matters
export const deleteAttachmentsFn = createServerFn({ method: "POST" })
  .validator(shape({ slug, ids: arr(id) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`delete from attachments where id = any(${data.ids}) and task_id in (
      select t.id from tasks t join sections sc on sc.id = t.section_id join pages p on p.id = sc.page_id
      where p.session_slug = ${s})`
  })

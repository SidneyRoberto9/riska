import { createFileRoute } from "@tanstack/react-router"
import { ID_RE } from "#/lib/id"
import { hasAccess } from "#/server/auth.server"
import { db } from "#/server/db.server"
import { presignGet, storageEnabled } from "#/server/storage.server"

const notFound = () => new Response(null, { status: 404 })

// Stable, cookie-checked URL for <img src>; redirects to a 1 h presigned GET that the browser caches for 50 min
export const Route = createFileRoute("/api/s/$slug/img/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!storageEnabled() || !ID_RE.test(params.id) || !(await hasAccess(params.slug))) {
          return notFound()
        }
        const sql = await db()
        const [row] = await sql<{ key: string }[]>`
          select a.key from attachments a join tasks t on t.id = a.task_id join sections sc on sc.id = t.section_id
            join pages p on p.id = sc.page_id
          where a.id = ${params.id} and p.session_slug = ${params.slug}`
        if (!row) {
          return notFound()
        }
        return new Response(null, {
          status: 302,
          headers: {
            Location: await presignGet(row.key),
            "Cache-Control": "private, max-age=3000",
            "X-Content-Type-Options": "nosniff",
          },
        })
      },
    },
  },
})

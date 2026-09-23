import { createServerFn } from '@tanstack/react-start'
import type { Settings } from '#/lib/types'
import { SLUG_RE } from '#/lib/id'
import { dummyHash, grantAccess, hasAccess, hashPin, requireAccess, revokeAccess, verifyPin } from './auth.server'
import { db } from './db.server'
import { mode, partial, pin, shape, slug, str, theme } from './validate'

const MAX_FAILS = 5

export type LoginResult = { ok: true } | { ok: false; reason: 'invalid' } | { ok: false; reason: 'locked'; until: string }

export const checkSlugFn = createServerFn()
  .validator(shape({ slug: str(100) }))
  .handler(async ({ data }) => {
    if (!SLUG_RE.test(data.slug)) return { available: false }
    const sql = await db()
    const [row] = await sql`select 1 from sessions where slug = ${data.slug}`
    return { available: !row }
  })

export const createSessionFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug, pin }))
  .handler(async ({ data }) => {
    const sql = await db()
    const pinHash = await hashPin(data.pin)
    const rows = await sql`
      insert into sessions (slug, pin_hash) values (${data.slug}, ${pinHash})
      on conflict (slug) do nothing returning slug`
    if (!rows.length) return { ok: false as const, reason: 'taken' as const }
    grantAccess(data.slug, pinHash)
    return { ok: true as const }
  })

export const loginFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug: str(100), pin: str(10) }))
  .handler(async ({ data }): Promise<LoginResult> => {
    const sql = await db()
    const [s] = SLUG_RE.test(data.slug)
      ? await sql<{ pinHash: string; lockedUntil: Date | null }[]>`
          select pin_hash, locked_until from sessions where slug = ${data.slug}`
      : []
    if (!s) {
      await verifyPin('0000', await dummyHash)
      return { ok: false, reason: 'invalid' }
    }
    if (s.lockedUntil && s.lockedUntil > new Date()) {
      return { ok: false, reason: 'locked', until: s.lockedUntil.toISOString() }
    }
    if (await verifyPin(data.pin, s.pinHash)) {
      await sql`update sessions set failed_attempts = 0, lock_level = 0, locked_until = null where slug = ${data.slug}`
      grantAccess(data.slug, s.pinHash)
      return { ok: true }
    }
    // Atomic increment so parallel guesses cannot share one counter value
    const [f] = await sql<{ failedAttempts: number; lockLevel: number }[]>`
      update sessions set failed_attempts = failed_attempts + 1
      where slug = ${data.slug} returning failed_attempts, lock_level`
    if (f.failedAttempts < MAX_FAILS) return { ok: false, reason: 'invalid' }
    const minutes = Math.min(15 * 2 ** f.lockLevel, 24 * 60)
    const [l] = await sql<{ lockedUntil: Date }[]>`
      update sessions set failed_attempts = 0, lock_level = lock_level + 1,
        locked_until = now() + make_interval(mins => ${minutes})
      where slug = ${data.slug} returning locked_until`
    return { ok: false, reason: 'locked', until: l.lockedUntil.toISOString() }
  })

export const accessFn = createServerFn()
  .validator(shape({ slug: str(100) }))
  .handler(async ({ data }) => ({ access: await hasAccess(data.slug) }))

export const getSettingsFn = createServerFn()
  .validator(shape({ slug: str(100) }))
  .handler(async ({ data }): Promise<Settings[]> => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    const [row] = await sql<Omit<Settings, 'id'>[]>`select theme, mode from sessions where slug = ${s}`
    return [{ id: 'settings', ...row }]
  })

// Root loader uses this; returns null instead of throwing so pages without access still render
export const themeFn = createServerFn()
  .validator(shape({ slug: str(100) }))
  .handler(async ({ data }) => {
    if (!(await hasAccess(data.slug))) return null
    const sql = await db()
    const [row] = await sql<Omit<Settings, 'id'>[]>`select theme, mode from sessions where slug = ${data.slug}`
    return row ? { theme: row.theme, mode: row.mode } : null
  })

export const updateSettingsFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug, changes: partial({ theme, mode }) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`update sessions set ${sql(data.changes)} where slug = ${s}`
  })

export const deleteSessionFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug, pin, confirm: str(100) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    if (data.confirm !== s) return { ok: false as const, reason: 'confirm' as const }
    const sql = await db()
    const [row] = await sql<{ pinHash: string }[]>`select pin_hash from sessions where slug = ${s}`
    if (!row || !(await verifyPin(data.pin, row.pinHash))) return { ok: false as const, reason: 'pin' as const }
    await sql`delete from sessions where slug = ${s}`
    revokeAccess(s)
    return { ok: true as const }
  })

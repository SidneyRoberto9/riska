import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server"
import { SLUG_RE } from "#/lib/id"
import { db } from "./db.server"

const scryptAsync = promisify(scrypt) as (pin: string, salt: Buffer, len: number) => Promise<Buffer>

export async function hashPin(pin: string) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(pin, salt, 32)
  return `${salt.toString("hex")}:${hash.toString("hex")}`
}

export async function verifyPin(pin: string, stored: string) {
  const [salt, hash] = stored.split(":")
  const got = await scryptAsync(pin, Buffer.from(salt, "hex"), 32)
  return timingSafeEqual(got, Buffer.from(hash, "hex"))
}

// Used to spend the same scrypt time when the slug does not exist (anti-enumeration)
export const dummyHash = hashPin("0000")

function secret() {
  const s = process.env.COOKIE_SECRET
  if (!s || s.length < 32) {
    throw new Error("COOKIE_SECRET must have at least 32 chars")
  }
  return s
}

const cookieName = (slug: string) => `ck_${slug}`

// Signature binds the cookie to the current pin_hash: deleting and recreating a slug
// (new salt) invalidates every cookie issued for the old session.
const token = (slug: string, pinHash: string) =>
  `${slug}.${createHmac("sha256", secret()).update(`${slug}:${pinHash}`).digest("base64url")}`

export function grantAccess(slug: string, pinHash: string) {
  setCookie(cookieName(slug), token(slug, pinHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}

export function revokeAccess(slug: string) {
  deleteCookie(cookieName(slug), { path: "/" })
}

export async function hasAccess(slug: unknown): Promise<boolean> {
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
    return false
  }
  const value = getCookie(cookieName(slug))
  if (!value) {
    return false
  }
  const sql = await db()
  const [row] = await sql<{ pinHash: string }[]>`select pin_hash from sessions where slug = ${slug}`
  if (!row) {
    return false
  }
  const expected = Buffer.from(token(slug, row.pinHash))
  const got = Buffer.from(value)
  return got.length === expected.length && timingSafeEqual(got, expected)
}

export async function requireAccess(slug: unknown): Promise<string> {
  if (!(await hasAccess(slug))) {
    throw new Error("UNAUTHORIZED")
  }
  return slug as string
}

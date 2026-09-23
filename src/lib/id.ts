import { customAlphabet } from "nanoid"

export const newId = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 16)
export const ID_RE = /^[A-Za-z0-9]{16}$/
export const SLUG_RE = /^[a-z0-9]{3,40}$/
export const PIN_RE = /^\d{4}$/

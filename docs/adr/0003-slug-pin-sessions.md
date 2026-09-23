# ADR 0003: Sessions as slug + PIN, no accounts, exponential lockout

## Status
Accepted

## Context
The lists are personal and low-stakes, used across a phone and a PC.
Accounts (email, password, reset flow) would be most of the product's
complexity and friction for little benefit.

## Decision
A session is a URL-safe slug plus a 4-digit PIN. The PIN is hashed with
scrypt (random salt); a correct PIN sets an `httpOnly` cookie per slug,
HMAC-signed with `COOKIE_SECRET` over `slug:pin_hash`, valid for a year.
Failed attempts are claimed atomically in SQL before verification; the
5th failure locks the session for `15 × 2^lock_level` minutes (max 24 h).
Unknown slugs still spend a scrypt verification.

## Consequences
- Zero sign-up friction: pick a name, pick a PIN, share the URL.
- 10,000 possible PINs is only safe because of the lockout — the atomic
  claim guarantees at most 5 verifications per lock window, even under
  concurrent requests. Changes there need a security review.
- A forgotten PIN can't be recovered; recreating the slug invalidates all
  old cookies because the signature covers the new hash.

import assert from "node:assert/strict"
import { test } from "node:test"

Object.assign(process.env, {
  R2_ACCOUNT_ID: "acc",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "bucket",
})
const { presignPut } = await import("./storage.server.ts")

test("a presigned PUT binds type and size and lives 5 minutes", async () => {
  const url = new URL(await presignPut("slug/id", "image/png", 1234))
  const signed = url.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? []
  assert.ok(signed.includes("content-type"))
  assert.ok(signed.includes("content-length"))
  assert.equal(url.searchParams.get("X-Amz-Expires"), "300")
  assert.equal(url.pathname, "/bucket/slug/id")
})

import assert from "node:assert/strict"
import { test } from "node:test"
import { checkImage, MAX_IMAGE_BYTES, pastedImages } from "./images.ts"

test("accepts the raster image types within the size limit", () => {
  for (const t of ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]) {
    assert.equal(checkImage(t, 1024), null)
  }
  assert.equal(checkImage("image/png", MAX_IMAGE_BYTES), null)
})

test("rejects SVG and non-images", () => {
  assert.equal(checkImage("image/svg+xml", 10), "type")
  assert.equal(checkImage("application/pdf", 10), "type")
  assert.equal(checkImage("", 10), "type")
})

test("rejects empty, oversized and non-integer sizes", () => {
  assert.equal(checkImage("image/png", 0), "size")
  assert.equal(checkImage("image/png", MAX_IMAGE_BYTES + 1), "size")
  assert.equal(checkImage("image/png", 1.5), "size")
  assert.equal(checkImage("image/png", Number.NaN), "size")
})

test("a paste with text into a text field is not an image paste", () => {
  const files = [{ name: "a.png" }] as unknown as File[]
  const office = { types: ["text/plain", "text/html", "Files"], files }
  const bare = { types: ["Files"], files }
  assert.equal(pastedImages({ tagName: "TEXTAREA" }, office).length, 0)
  assert.equal(pastedImages({ tagName: "INPUT" }, office).length, 0)
  assert.equal(pastedImages({ tagName: "DIV", isContentEditable: true }, office).length, 0)
  assert.equal(pastedImages({ tagName: "TEXTAREA" }, bare).length, 1)
  assert.equal(pastedImages({ tagName: "BUTTON" }, office).length, 1)
  assert.equal(pastedImages(null, bare).length, 1)
})

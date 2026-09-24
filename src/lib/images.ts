// No SVG: it can carry script and would be served from our bucket
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"] as const
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",")
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGES_PER_TASK = 20

export const IMAGE_ERRORS = {
  type: "Só imagens PNG, JPEG, WebP, GIF ou AVIF.",
  size: "Imagem maior que 10 MB.",
} as const

export function checkImage(type: string, size: number): "type" | "size" | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(type)) {
    return "type"
  }
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
    return "size"
  }
  return null
}

// Files to upload from a paste, or none. Office apps put an image/png next to the text they copy, so a
// paste with text into a text field stays a text paste.
export function pastedImages(
  target: { tagName?: string; isContentEditable?: boolean } | null,
  data: { types: readonly string[]; files: ArrayLike<File> }
): File[] {
  const textField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable === true
  if (textField && data.types.includes("text/plain")) {
    return []
  }
  return Array.from(data.files)
}

import { AwsClient } from "aws4fetch"

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    return null
  }
  return { account: R2_ACCOUNT_ID, key: R2_ACCESS_KEY_ID, secret: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET }
}

export const storageEnabled = () => config() !== null

let client: AwsClient | undefined

function r2() {
  const c = config()
  if (!c) {
    throw new Error("STORAGE_DISABLED")
  }
  client ??= new AwsClient({ accessKeyId: c.key, secretAccessKey: c.secret, service: "s3", region: "auto" })
  return { client, base: `https://${c.account}.r2.cloudflarestorage.com/${c.bucket}` }
}

export const objectKey = (slug: string, id: string) => `${slug}/${id}`

// allHeaders: aws4fetch skips Content-Type by default; signing it makes R2 reject a PUT with any other type
async function presign(method: "GET" | "PUT", key: string, seconds: number, headers?: Record<string, string>) {
  const { client, base } = r2()
  const url = new URL(`${base}/${key}`)
  url.searchParams.set("X-Amz-Expires", String(seconds))
  const signed = await client.sign(new Request(url, { method, headers }), {
    aws: { signQuery: true, allHeaders: true },
  })
  return signed.url
}

// Content-Length is signed too: without it the URL would accept any body size up to 300s after issuing,
// letting a small approved upload be replaced by an oversized one before insertAttachmentsFn's HEAD check
export const presignPut = (key: string, contentType: string, size: number) =>
  presign("PUT", key, 300, { "Content-Type": contentType, "Content-Length": String(size) })
export const presignGet = (key: string) => presign("GET", key, 3600)

export async function headObject(key: string): Promise<{ size: number; contentType: string } | null> {
  const { client, base } = r2()
  const res = await client.fetch(`${base}/${key}`, { method: "HEAD" })
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error(`R2 HEAD ${res.status}`)
  }
  return { size: Number(res.headers.get("content-length")), contentType: res.headers.get("content-type") ?? "" }
}

export async function deleteObject(key: string) {
  const { client, base } = r2()
  const res = await client.fetch(`${base}/${key}`, { method: "DELETE" })
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 DELETE ${res.status}`)
  }
}

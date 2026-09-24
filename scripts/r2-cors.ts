// Usage: node --env-file=.env scripts/r2-cors.ts https://app.example.com http://localhost:3000
import { createHash } from "node:crypto"
import { AwsClient } from "aws4fetch"

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
const origins = process.argv.slice(2)
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !origins.length) {
  throw new Error("Set R2_* in the env and pass at least one origin")
}
const body = `<CORSConfiguration><CORSRule>${origins.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join("")}<AllowedMethod>PUT</AllowedMethod><AllowedHeader>content-type</AllowedHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`
const aws = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
})
const res = await aws.fetch(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}?cors`, {
  method: "PUT",
  body,
  headers: { "Content-MD5": createHash("md5").update(body).digest("base64"), "Content-Type": "application/xml" },
})
process.stdout.write(`${res.status} ${await res.text()}\n`)

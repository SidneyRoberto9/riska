import postgres from "postgres"
import schema from "./schema.sql?raw"

const client = postgres(process.env.DATABASE_URL ?? "", {
  max: 5,
  transform: postgres.camel,
  onnotice: () => {},
})

let ready: Promise<unknown> | undefined

// ponytail: lazy migration on first query instead of a boot hook; a failed run is retried on the next request
export async function db() {
  ready ??= client.unsafe(schema).catch((e) => {
    ready = undefined
    throw e
  })
  await ready
  return client
}

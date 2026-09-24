import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig, type Plugin } from "vite"

// Nitro's dev middleware sends any `Sec-Fetch-Dest: image` request to Vite's static files (404), so API routes used as <img src> break in dev
const apiNotAsset: Plugin = {
  name: "api-not-asset",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url?.startsWith("/api/")) {
        req.headers["sec-fetch-dest"] = "empty"
      }
      next()
    })
  },
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [apiNotAsset, nitro(), tailwindcss(), tanstackStart(), viteReact()],
})

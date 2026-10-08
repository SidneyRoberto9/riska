import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { ToastProvider } from "#/components/ToastProvider"
import { localThemeScript } from "#/data/theme"
import { themeFn } from "#/server/session"
import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Theme for /s/<slug> is resolved on the server so the first paint is already themed
  loader: async ({ location }) => {
    const m = location.pathname.match(/^\/s\/([a-z0-9]{3,40})/)
    return m ? await themeFn({ data: { slug: m[1] } }) : null
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Checklist" },
    ],
    links: [
      // Icon set from docs/brand/export (served from public/)
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: () => (
    <ToastProvider>
      <Outlet />
    </ToastProvider>
  ),
})

function RootDocument({ children }: { children: ReactNode }) {
  const theme = Route.useLoaderData()
  return (
    <html lang="pt-BR" data-theme={theme?.theme ?? "roxo"} data-mode={theme?.mode ?? "system"} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static constant, sets the theme before paint to avoid a flash */}
        <script dangerouslySetInnerHTML={{ __html: localThemeScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

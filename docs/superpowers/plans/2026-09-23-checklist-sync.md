# Checklist Sincronizado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App de checklist (páginas → seções → tarefas com badges) sincronizado entre dispositivos via slug + PIN em Postgres, com modo anônimo em localStorage, optimistic UI e 6 temas.

**Architecture:** TanStack Start (Nitro/Node) com server functions acessando Postgres via `postgres` (SQL puro). No cliente, TanStack DB: a UI consome uma `Source` (4 collections: pages, sections, tasks, settings) que é `queryCollectionOptions` (server functions, polling 15 s) no modo slug ou `localStorageCollectionOptions` no modo anônimo — mesma UI, mutações otimistas com rollback automático. Rotas `/s/$slug*` usam `ssr: 'data-only'`: loader valida cookie e pré-carrega as queries no servidor; componentes renderizam no cliente.

**Tech Stack:** TanStack Start 1.168 · TanStack Router · TanStack Query 5 · TanStack DB 0.9 (`@tanstack/react-db`, `@tanstack/query-db-collection`) · `@tanstack/react-router-ssr-query` · React 19 · Tailwind CSS 4 · Vite 8 · Nitro 3 · `postgres` 3.4 · `nanoid` 6 · Node 24.

**Spec:** `docs/superpowers/specs/2026-09-23-checklist-sync-design.md`

**Nota de verificação:** todo o código deste plano foi escrito e validado num projeto-rascunho (`/tmp/claude-1000/-home-sid-www-personal-checklist/068472d2-e609-4599-b0ed-74330b39ecb9/scratchpad/probe`) antes da escrita do plano: `tsc` sem erros, `vite build` ok, sem vazamento de código de servidor no bundle cliente, e smoke E2E no navegador (criar sessão, página, seção, tarefa, badge, reordenar, tema persistido com SSR, PIN com bloqueio, deletar sessão com cascade, modo anônimo). O banco `checklist` já existe no Postgres e o schema já foi aplicado (tabelas vazias). O arquivo `/tmp/claude-1000/-home-sid-www-personal-checklist/068472d2-e609-4599-b0ed-74330b39ecb9/scratchpad/probe/.env` contém `DATABASE_URL` e `COOKIE_SECRET` válidos.

## Global Constraints

- Gerenciador de pacotes: **npm** apenas (`npm install`, `npm run`, `npx`, `package-lock.json`). Nunca pnpm/yarn/bun.
- Dependências fora do ecossistema TanStack: somente `postgres` e `nanoid` (mais o que o scaffold oficial traz: react, vite, tailwind, nitro, typescript).
- Sem testes automatizados (pedido do usuário). Verificação = `npm run typecheck`, `npm run build` e checagens manuais/E2E descritas nas tasks.
- Commits: **nunca** `git commit` direto — invocar a skill `auto-commit` ao fim de cada task (ela decide staging, divide commits e formata mensagens).
- Credenciais só em `.env` (no `.gitignore`); nunca em código, plano, spec ou commit. `.env.example` versionado sem valores.
- Slug: `^[a-z0-9]{3,40}$`, imutável. PIN: exatamente 4 dígitos. IDs: nanoid alfabeto `A-Za-z0-9`, 16 chars, gerados no cliente.
- Idioma da UI: português (pt-BR). Import alias `#/*` → `src/*` (já configurado pelo scaffold).
- Código deve ser copiado **exatamente** como está neste plano (foi validado). Se algo divergir por versão de pacote, ajuste o mínimo e anote no relatório da task.

## Review Focus

1. **Refetch durante mutação pendente (2 dispositivos):** polling de 15 s chegando enquanto um update otimista ainda não confirmou não pode reverter a UI → Task 5 passo E2E "marcar e aguardar 16 s".
2. **Sessão deletada e recriada com o mesmo slug:** cookie antigo de outro aparelho não pode dar acesso (assinatura inclui `pin_hash`) → Task 5 passo E2E "recriar slug".
3. **PIN com força bruta/paralelismo:** 5 erros → bloqueio progressivo; contador incrementado atomicamente → Task 5 passo E2E de bloqueio.
4. **Página/seção vazia:** progresso `0/0` sem `NaN`, barra vazia → Task 5 passo E2E "página nova".
5. **Navegador sem Web Speech API (Firefox):** botão 🎤 não renderiza; permissão negada encerra gravação sem quebrar → Task 5 passo manual de voz.

---

## File Structure

```
Dockerfile, .dockerignore, .env.example, .gitignore
package.json, package-lock.json, tsconfig.json, tsr.config.json, vite.config.ts
src/
  styles.css                 tokens Tailwind v4 + 6 temas (light-dark()) + checkbox do artefato
  router.tsx                 QueryClient + router + integração SSR do Query
  routeTree.gen.ts           gerado
  lib/types.ts               tipos de domínio, temas, modos, paleta de badges, limites
  lib/id.ts                  newId (nanoid), regex de id/slug/PIN
  server/schema.sql          DDL idempotente
  server/db.server.ts        cliente postgres + migração lazy
  server/validate.ts         validação manual de entrada (trust boundary)
  server/auth.server.ts      scrypt, cookie HMAC, hasAccess/requireAccess
  server/session.ts          server fns: slug, criar, login+bloqueio, acesso, settings, deletar
  server/data.ts             server fns: list/insert/update/delete de pages/sections/tasks
  data/source.ts             Source (collections server/local) + queryKeys
  data/source-context.tsx    contexto React da Source
  data/actions.ts            useActions(): mutações otimistas + retry/401
  data/theme.ts              useSettings/useApplyTheme + script anti-flash do modo local
  data/recent.ts             sessões recentes (localStorage)
  components/toast.tsx       toast próprio com "Tentar de novo"
  components/Popover.tsx     Popover (popover API nativa), Menu, MenuItem
  components/InlineEdit.tsx  edição inline
  components/ProgressBar.tsx
  components/Badge.tsx       BadgeChip + BadgeEditor
  components/VoiceButton.tsx Web Speech API
  components/Shell.tsx       container + aplica tema; NotFound
  components/TaskRow.tsx     TaskRow + NewTaskInput
  components/SectionCard.tsx
  components/Settings.tsx    SettingsButton (tema, modo, link, deletar)
  components/PinGate.tsx
  components/links.tsx       PageLink/PagesLink tipados
  components/ChecklistView.tsx
  components/PagesView.tsx
  routes/__root.tsx, index.tsx, local.tsx, local.index.tsx, local.p.$pageId.tsx,
         s.$slug.tsx, s.$slug.index.tsx, s.$slug.p.$pageId.tsx
```

---

### Task 1: Scaffold, infraestrutura, temas e banco

**Files:**
- Create: todos os arquivos do scaffold, `vite.config.ts`, `package.json` (scripts), `.env`, `.env.example`, `.dockerignore`, `Dockerfile`, `src/styles.css`, `src/lib/types.ts`, `src/lib/id.ts`, `src/server/schema.sql`, `src/server/db.server.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `db(): Promise<postgres.Sql>` (colunas em camelCase via `postgres.camel`); tipos `Page`, `Section`, `Task`, `Settings`, `Badge`, `ThemeId`, `Mode`; constantes `THEMES`, `MODES`, `BADGE_COLORS`, `LIMITS`, `DEFAULT_SETTINGS`; `newId()`, `ID_RE`, `SLUG_RE`, `PIN_RE`; classes Tailwind `bg-ground text-ink text-ink-soft border-line bg-surface bg-accent text-accent bg-accent-soft text-done text-warn bg-warn-soft font-display` e classe CSS `.check`.

- [ ] **Step 1: Scaffold oficial num diretório temporário e copiar para o repo**

```bash
cd /tmp/claude-1000/-home-sid-www-personal-checklist/068472d2-e609-4599-b0ed-74330b39ecb9/scratchpad
rm -rf app && npx -y @tanstack/cli@latest create app --framework React --package-manager npm --deployment nitro --no-toolchain --no-examples --no-git --no-intent --non-interactive
cd app && rm -rf README.md .cta.json .vscode node_modules
cp -r . /home/sid/www/personal/checklist/  # copia package.json, package-lock.json, tsconfig.json, tsr.config.json, vite.config.ts, src/ e o .gitignore do scaffold (sobrescreve)
```

- [ ] **Step 2: Ajustar `.gitignore` do repo** (o scaffold sobrescreveu o original). Conteúdo final:

```
node_modules
.DS_Store
dist
dist-ssr
*.local
.env
.env.*
!.env.example
.nitro
.tanstack
.output
.vinxi
.playwright-mcp
```

- [ ] **Step 3: Dependências** (em `/home/sid/www/personal/checklist`)

```bash
npm rm @tanstack/react-devtools @tanstack/react-router-devtools @tanstack/devtools-vite
npm i @tanstack/react-query @tanstack/react-db @tanstack/query-db-collection @tanstack/react-router-ssr-query postgres nanoid
```

Remover o bloco `"pnpm": {...}` do `package.json` e trocar `"scripts"` por:

```json
"scripts": {
  "dev": "node --env-file-if-exists=.env node_modules/vite/bin/vite.js dev --port 3000",
  "generate-routes": "tsr generate",
  "build": "vite build",
  "start": "node --env-file-if-exists=.env .output/server/index.mjs",
  "typecheck": "tsc --noEmit"
}
```

(`--env-file` porque o servidor lê `process.env.DATABASE_URL`/`COOKIE_SECRET`; Vite não injeta `.env` em `process.env`.)

- [ ] **Step 4: Env**

```bash
cp /tmp/claude-1000/-home-sid-www-personal-checklist/068472d2-e609-4599-b0ed-74330b39ecb9/scratchpad/probe/.env /home/sid/www/personal/checklist/.env
printf 'DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/checklist\nCOOKIE_SECRET=gere-com-node-e-crypto-randomBytes-32-base64url\n' > /home/sid/www/personal/checklist/.env.example
```

- [ ] **Step 5: `vite.config.ts`** (sem devtools)

`vite.config.ts`

````ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [nitro(), tailwindcss(), tanstackStart(), viteReact()],
})
````

- [ ] **Step 6: Tema e estilos** — substituir `src/styles.css`:

`src/styles.css`

````css
@import "tailwindcss";

@theme inline {
  --color-ink: var(--ink);
  --color-ink-soft: var(--ink-soft);
  --color-line: var(--line);
  --color-surface: var(--surface);
  --color-ground: var(--ground);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --color-done: var(--done);
  --color-done-soft: var(--done-soft);
  --color-warn: var(--warn);
  --color-warn-soft: var(--warn-soft);
  --font-sans: "IBM Plex Sans", system-ui, sans-serif;
  --font-display: "Manrope", system-ui, sans-serif;
}

/* light-dark() picks the value from the active color-scheme, so each preset is one block */
:root {
  color-scheme: light dark;
  --done: light-dark(#16a34a, #4ade80);
  --done-soft: light-dark(#e9f8ee, #1c3327);
  --warn: light-dark(#b45309, #fbbf24);
  --warn-soft: light-dark(#fdf1de, #3a2c11);
}
:root[data-mode="light"] { color-scheme: light; }
:root[data-mode="dark"] { color-scheme: dark; }

:root, :root[data-theme="roxo"] {
  --ink: light-dark(#1c1a22, #f1eef7);
  --ink-soft: light-dark(#5b5766, #b8b2c8);
  --line: light-dark(#e4e0ec, #332f40);
  --surface: light-dark(#ffffff, #211f2b);
  --ground: light-dark(#faf9fc, #17151e);
  --accent: light-dark(#6d28d9, #a78bfa);
  --accent-soft: light-dark(#efe7fc, #2c2540);
}
:root[data-theme="rosa"] {
  --ink: light-dark(#221a1f, #f7eef3);
  --ink-soft: light-dark(#66575f, #c8b2bd);
  --line: light-dark(#ece0e6, #402f38);
  --surface: light-dark(#ffffff, #2b1f25);
  --ground: light-dark(#fcf9fa, #1e151a);
  --accent: light-dark(#be185d, #f472b6);
  --accent-soft: light-dark(#fce7f1, #402533);
}
:root[data-theme="verde"] {
  --ink: light-dark(#1a221d, #eef7f1);
  --ink-soft: light-dark(#57665c, #b2c8ba);
  --line: light-dark(#e0ece4, #2f4035);
  --surface: light-dark(#ffffff, #1f2b23);
  --ground: light-dark(#f9fcfa, #151e18);
  --accent: light-dark(#047857, #34d399);
  --accent-soft: light-dark(#e3f6ee, #1f3a2f);
}
:root[data-theme="azul"] {
  --ink: light-dark(#1a1e22, #eef3f7);
  --ink-soft: light-dark(#576066, #b2bec8);
  --line: light-dark(#e0e6ec, #2f3840);
  --surface: light-dark(#ffffff, #1f252b);
  --ground: light-dark(#f9fbfc, #151a1e);
  --accent: light-dark(#1d4ed8, #60a5fa);
  --accent-soft: light-dark(#e6eefc, #1f2d44);
}
:root[data-theme="ambar"] {
  --ink: light-dark(#221e1a, #f7f3ee);
  --ink-soft: light-dark(#665e57, #c8bdb2);
  --line: light-dark(#ece6e0, #40382f);
  --surface: light-dark(#ffffff, #2b251f);
  --ground: light-dark(#fcfaf7, #1e1a15);
  --accent: light-dark(#c2410c, #fb923c);
  --accent-soft: light-dark(#fdeee3, #3f2a1c);
}
:root[data-theme="grafite"] {
  --ink: light-dark(#18181b, #f4f4f5);
  --ink-soft: light-dark(#52525b, #a1a1aa);
  --line: light-dark(#e4e4e7, #3f3f46);
  --surface: light-dark(#ffffff, #27272a);
  --ground: light-dark(#fafafa, #18181b);
  --accent: light-dark(#3f3f46, #d4d4d8);
  --accent-soft: light-dark(#f4f4f5, #3f3f46);
}

html {
  scroll-padding-top: env(safe-area-inset-top, 0px);
}
body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--font-sans);
  -webkit-tap-highlight-color: transparent;
}
h1, h2, h3 {
  font-family: var(--font-display);
  text-wrap: balance;
}

/* Checkbox from the reference artifact */
.check {
  appearance: none;
  width: 19px;
  height: 19px;
  min-width: 19px;
  margin: 1px 0 0;
  border: 1.6px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  cursor: pointer;
  display: grid;
  place-content: center;
}
.check::before {
  content: "";
  width: 10px;
  height: 10px;
  border-radius: 2px;
  transform: scale(0);
  transition: transform 0.12s ease;
  background: var(--done);
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 45% 62%);
}
.check:checked {
  border-color: var(--done);
  background: var(--done-soft);
}
.check:checked::before {
  transform: scale(1);
}

/* Popovers are positioned by JS next to their trigger (see Menu) */
[popover] {
  margin: 0;
  inset: auto;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 8px 30px rgb(0 0 0 / 0.15);
}
````

- [ ] **Step 7: Domínio e ids**

`src/lib/types.ts`

````ts
export const THEMES = [
  { id: 'roxo', label: 'Roxo', swatch: '#6d28d9' },
  { id: 'rosa', label: 'Rosa', swatch: '#be185d' },
  { id: 'verde', label: 'Verde', swatch: '#047857' },
  { id: 'azul', label: 'Azul', swatch: '#1d4ed8' },
  { id: 'ambar', label: 'Âmbar', swatch: '#c2410c' },
  { id: 'grafite', label: 'Grafite', swatch: '#3f3f46' },
] as const
export type ThemeId = (typeof THEMES)[number]['id']

export const MODES = [
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
  { id: 'system', label: 'Sistema' },
] as const
export type Mode = (typeof MODES)[number]['id']

export const BADGE_COLORS = ['#dc2626', '#ea580c', '#d97706', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#6b7280']

export const LIMITS = { title: 200, note: 500, task: 1000, badges: 10, badgeText: 30 }

export type Badge = { text: string; color: string }
export type Page = { id: string; title: string; subtitle: string; position: number }
export type Section = { id: string; pageId: string; title: string; note: string; highlight: boolean; position: number }
// pageId is derived server-side from the section (not a column); kept on the client for cheap per-page filtering
export type Task = { id: string; sectionId: string; pageId: string; text: string; done: boolean; badges: Badge[]; position: number }
export type Settings = { id: 'settings'; theme: ThemeId; mode: Mode }

export const DEFAULT_SETTINGS: Settings = { id: 'settings', theme: 'roxo', mode: 'system' }
````

`src/lib/id.ts`

````ts
import { customAlphabet } from 'nanoid'

export const newId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 16)
export const ID_RE = /^[A-Za-z0-9]{16}$/
export const SLUG_RE = /^[a-z0-9]{3,40}$/
export const PIN_RE = /^\d{4}$/
````

- [ ] **Step 8: Banco**

`src/server/schema.sql`

````sql
CREATE TABLE IF NOT EXISTS sessions (
  slug            text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]{3,40}$'),
  pin_hash        text NOT NULL,
  theme           text NOT NULL DEFAULT 'roxo',
  mode            text NOT NULL DEFAULT 'system',
  failed_attempts int  NOT NULL DEFAULT 0,
  lock_level      int  NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pages (
  id           text PRIMARY KEY,
  session_slug text NOT NULL REFERENCES sessions ON DELETE CASCADE,
  title        text NOT NULL,
  subtitle     text NOT NULL DEFAULT '',
  position     int  NOT NULL
);
CREATE TABLE IF NOT EXISTS sections (
  id        text PRIMARY KEY,
  page_id   text NOT NULL REFERENCES pages ON DELETE CASCADE,
  title     text NOT NULL,
  note      text NOT NULL DEFAULT '',
  highlight boolean NOT NULL DEFAULT false,
  position  int NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id         text PRIMARY KEY,
  section_id text NOT NULL REFERENCES sections ON DELETE CASCADE,
  text       text NOT NULL,
  done       boolean NOT NULL DEFAULT false,
  badges     jsonb NOT NULL DEFAULT '[]',
  position   int NOT NULL
);
CREATE INDEX IF NOT EXISTS pages_session_idx ON pages (session_slug);
CREATE INDEX IF NOT EXISTS sections_page_idx ON sections (page_id);
CREATE INDEX IF NOT EXISTS tasks_section_idx ON tasks (section_id);
````

`src/server/db.server.ts`

````ts
import postgres from 'postgres'
import schema from './schema.sql?raw'

const client = postgres(process.env.DATABASE_URL ?? '', {
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
````

- [ ] **Step 9: Docker**

`Dockerfile`

````dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
````

`.dockerignore`

````
node_modules
.output
.nitro
.tanstack
.git
.env
.env.*
docs
.playwright-mcp
````

(Nitro empacota as dependências em `.output/server`, então o runtime não precisa de `node_modules`.)

- [ ] **Step 10: Verificar**

```bash
npm run generate-routes && npm run typecheck && npm run build
node --env-file=.env -e "const p=require('postgres');const s=p(process.env.DATABASE_URL);s\`select count(*)::int n from information_schema.tables where table_name in ('sessions','pages','sections','tasks')\`.then(r=>{console.log(r[0].n);return s.end()})"
```

Expected: typecheck sem erros, build conclui (avisos `"use client"` do react-query são normais), o node imprime `4`.

- [ ] **Step 11: Commit** — invocar a skill `auto-commit`.

---

### Task 2: Servidor — validação, auth/PIN e server functions

**Files:**
- Create: `src/server/validate.ts`, `src/server/auth.server.ts`, `src/server/session.ts`, `src/server/data.ts`

**Interfaces:**
- Consumes: `db()`, tipos e regex da Task 1.
- Produces (server fns, chamadas como `fn({ data })`):
  - `checkSlugFn({slug}) → {available: boolean}`
  - `createSessionFn({slug, pin}) → {ok: true} | {ok: false, reason: 'taken'}` (grava cookie)
  - `loginFn({slug, pin}) → LoginResult` = `{ok:true} | {ok:false,reason:'invalid'} | {ok:false,reason:'locked',until:string}`
  - `accessFn({slug}) → {access: boolean}`
  - `getSettingsFn({slug}) → Settings[]` (1 item, id `'settings'`)
  - `themeFn({slug}) → {theme, mode} | null` (nunca lança)
  - `updateSettingsFn({slug, changes: Partial<{theme, mode}>})`
  - `deleteSessionFn({slug, pin, confirm}) → {ok:true} | {ok:false, reason:'confirm'|'pin'}`
  - `listPagesFn/listSectionsFn/listTasksFn({slug}) → Page[]/Section[]/Task[]`
  - `insert{Pages,Sections,Tasks}Fn({slug, items})`, `update…Fn({slug, items: {id, changes}[]})`, `delete…Fn({slug, ids})`
  - Erros lançados: `Error('UNAUTHORIZED')`, `Error('INVALID')`, `Error('NOT_FOUND')`.

- [ ] **Step 1: Validação** (manual, sem Zod; limites da spec)

`src/server/validate.ts`

````ts
import { ID_RE, PIN_RE, SLUG_RE } from '#/lib/id'
import { LIMITS, MODES, THEMES, type Badge } from '#/lib/types'

type Check<T> = (v: unknown) => T
type Shape = Record<string, Check<unknown>>
type Out<S extends Shape> = { [K in keyof S]: ReturnType<S[K]> }

export function invalid(): never {
  throw new Error('INVALID')
}

const obj = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : invalid()

export const str = (max: number): Check<string> => (v) =>
  typeof v === 'string' && v.length <= max ? v : invalid()
export const id: Check<string> = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : invalid())
export const slug: Check<string> = (v) => (typeof v === 'string' && SLUG_RE.test(v) ? v : invalid())
export const pin: Check<string> = (v) => (typeof v === 'string' && PIN_RE.test(v) ? v : invalid())
export const bool: Check<boolean> = (v) => (typeof v === 'boolean' ? v : invalid())
export const int: Check<number> = (v) => (Number.isSafeInteger(v) ? (v as number) : invalid())
export const oneOf = <T extends string>(list: readonly T[]): Check<T> => (v) =>
  list.includes(v as T) ? (v as T) : invalid()
export const arr = <T>(each: Check<T>, max = 500): Check<T[]> => (v) =>
  Array.isArray(v) && v.length <= max ? v.map(each) : invalid()

const color: Check<string> = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/.test(v) ? v : invalid())
export const badges: Check<Badge[]> = arr((b) => {
  const o = obj(b)
  return { text: str(LIMITS.badgeText)(o.text), color: color(o.color) }
}, LIMITS.badges)

export const theme = oneOf(THEMES.map((t) => t.id))
export const mode = oneOf(MODES.map((m) => m.id))

export function shape<S extends Shape>(s: S): Check<Out<S>> {
  return (v) => {
    const o = obj(v)
    return Object.fromEntries(Object.entries(s).map(([k, f]) => [k, f(o[k])])) as Out<S>
  }
}

export function partial<S extends Shape>(s: S): Check<Partial<Out<S>>> {
  return (v) => {
    const o = obj(v)
    const keys = Object.keys(o)
    if (!keys.length) invalid()
    return Object.fromEntries(keys.map((k) => [k, (s[k] ?? invalid)(o[k])])) as Partial<Out<S>>
  }
}

export const pageFields = { title: str(LIMITS.title), subtitle: str(LIMITS.title), position: int }
export const sectionFields = { title: str(LIMITS.title), note: str(LIMITS.note), highlight: bool, position: int }
export const taskFields = { text: str(LIMITS.task), done: bool, badges, position: int }
````

- [ ] **Step 2: Auth** — scrypt, cookie HMAC ligado ao `pin_hash` (recriar o slug invalida cookies antigos)

`src/server/auth.server.ts`

````ts
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { SLUG_RE } from '#/lib/id'
import { db } from './db.server'

const scryptAsync = promisify(scrypt) as (pin: string, salt: Buffer, len: number) => Promise<Buffer>

export async function hashPin(pin: string) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(pin, salt, 32)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function verifyPin(pin: string, stored: string) {
  const [salt, hash] = stored.split(':')
  const got = await scryptAsync(pin, Buffer.from(salt, 'hex'), 32)
  return timingSafeEqual(got, Buffer.from(hash, 'hex'))
}

// Used to spend the same scrypt time when the slug does not exist (anti-enumeration)
export const dummyHash = hashPin('0000')

function secret() {
  const s = process.env.COOKIE_SECRET
  if (!s || s.length < 32) throw new Error('COOKIE_SECRET must have at least 32 chars')
  return s
}

const cookieName = (slug: string) => `ck_${slug}`

// Signature binds the cookie to the current pin_hash: deleting and recreating a slug
// (new salt) invalidates every cookie issued for the old session.
const token = (slug: string, pinHash: string) =>
  `${slug}.${createHmac('sha256', secret()).update(`${slug}:${pinHash}`).digest('base64url')}`

export function grantAccess(slug: string, pinHash: string) {
  setCookie(cookieName(slug), token(slug, pinHash), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}

export function revokeAccess(slug: string) {
  deleteCookie(cookieName(slug), { path: '/' })
}

export async function hasAccess(slug: unknown): Promise<boolean> {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return false
  const value = getCookie(cookieName(slug))
  if (!value) return false
  const sql = await db()
  const [row] = await sql<{ pinHash: string }[]>`select pin_hash from sessions where slug = ${slug}`
  if (!row) return false
  const expected = Buffer.from(token(slug, row.pinHash))
  const got = Buffer.from(value)
  return got.length === expected.length && timingSafeEqual(got, expected)
}

export async function requireAccess(slug: unknown): Promise<string> {
  if (!(await hasAccess(slug))) throw new Error('UNAUTHORIZED')
  return slug as string
}
````

- [ ] **Step 3: Sessão** — bloqueio progressivo 15 min × 2^nível (teto 24 h) a cada 5 erros; slug inexistente responde como PIN errado

`src/server/session.ts`

````ts
import { createServerFn } from '@tanstack/react-start'
import type { Settings } from '#/lib/types'
import { SLUG_RE } from '#/lib/id'
import { dummyHash, grantAccess, hasAccess, hashPin, requireAccess, revokeAccess, verifyPin } from './auth.server'
import { db } from './db.server'
import { mode, partial, pin, shape, slug, str, theme } from './validate'

const MAX_FAILS = 5

export type LoginResult = { ok: true } | { ok: false; reason: 'invalid' } | { ok: false; reason: 'locked'; until: string }

export const checkSlugFn = createServerFn()
  .validator(shape({ slug: str(100) }))
  .handler(async ({ data }) => {
    if (!SLUG_RE.test(data.slug)) return { available: false }
    const sql = await db()
    const [row] = await sql`select 1 from sessions where slug = ${data.slug}`
    return { available: !row }
  })

export const createSessionFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug, pin }))
  .handler(async ({ data }) => {
    const sql = await db()
    const pinHash = await hashPin(data.pin)
    const rows = await sql`
      insert into sessions (slug, pin_hash) values (${data.slug}, ${pinHash})
      on conflict (slug) do nothing returning slug`
    if (!rows.length) return { ok: false as const, reason: 'taken' as const }
    grantAccess(data.slug, pinHash)
    return { ok: true as const }
  })

export const loginFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug: str(100), pin: str(10) }))
  .handler(async ({ data }): Promise<LoginResult> => {
    const sql = await db()
    const [s] = SLUG_RE.test(data.slug)
      ? await sql<{ pinHash: string; lockedUntil: Date | null }[]>`
          select pin_hash, locked_until from sessions where slug = ${data.slug}`
      : []
    if (!s) {
      await verifyPin('0000', await dummyHash)
      return { ok: false, reason: 'invalid' }
    }
    if (s.lockedUntil && s.lockedUntil > new Date()) {
      return { ok: false, reason: 'locked', until: s.lockedUntil.toISOString() }
    }
    if (await verifyPin(data.pin, s.pinHash)) {
      await sql`update sessions set failed_attempts = 0, lock_level = 0, locked_until = null where slug = ${data.slug}`
      grantAccess(data.slug, s.pinHash)
      return { ok: true }
    }
    // Atomic increment so parallel guesses cannot share one counter value
    const [f] = await sql<{ failedAttempts: number; lockLevel: number }[]>`
      update sessions set failed_attempts = failed_attempts + 1
      where slug = ${data.slug} returning failed_attempts, lock_level`
    if (f.failedAttempts < MAX_FAILS) return { ok: false, reason: 'invalid' }
    const minutes = Math.min(15 * 2 ** f.lockLevel, 24 * 60)
    const [l] = await sql<{ lockedUntil: Date }[]>`
      update sessions set failed_attempts = 0, lock_level = lock_level + 1,
        locked_until = now() + make_interval(mins => ${minutes})
      where slug = ${data.slug} returning locked_until`
    return { ok: false, reason: 'locked', until: l.lockedUntil.toISOString() }
  })

export const accessFn = createServerFn()
  .validator(shape({ slug: str(100) }))
  .handler(async ({ data }) => ({ access: await hasAccess(data.slug) }))

export const getSettingsFn = createServerFn()
  .validator(shape({ slug: str(100) }))
  .handler(async ({ data }): Promise<Settings[]> => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    const [row] = await sql<Omit<Settings, 'id'>[]>`select theme, mode from sessions where slug = ${s}`
    return [{ id: 'settings', ...row }]
  })

// Root loader uses this; returns null instead of throwing so pages without access still render
export const themeFn = createServerFn()
  .validator(shape({ slug: str(100) }))
  .handler(async ({ data }) => {
    if (!(await hasAccess(data.slug))) return null
    const sql = await db()
    const [row] = await sql<Omit<Settings, 'id'>[]>`select theme, mode from sessions where slug = ${data.slug}`
    return row ? { theme: row.theme, mode: row.mode } : null
  })

export const updateSettingsFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug, changes: partial({ theme, mode }) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`update sessions set ${sql(data.changes)} where slug = ${s}`
  })

export const deleteSessionFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug, pin, confirm: str(100) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    if (data.confirm !== s) return { ok: false as const, reason: 'confirm' as const }
    const sql = await db()
    const [row] = await sql<{ pinHash: string }[]>`select pin_hash from sessions where slug = ${s}`
    if (!row || !(await verifyPin(data.pin, row.pinHash))) return { ok: false as const, reason: 'pin' as const }
    await sql`delete from sessions where slug = ${s}`
    revokeAccess(s)
    return { ok: true as const }
  })
````

- [ ] **Step 4: Dados** — toda escrita filtra por posse da sessão; `badges` enviado como jsonb

`src/server/data.ts`

````ts
import { createServerFn } from '@tanstack/react-start'
import type { Page, Section, Task } from '#/lib/types'
import { requireAccess } from './auth.server'
import { db } from './db.server'
import { arr, id, pageFields, partial, sectionFields, shape, slug, taskFields } from './validate'

const bySlug = shape({ slug })
const updates = <S extends Record<string, (v: unknown) => unknown>>(fields: S) =>
  shape({ slug, items: arr(shape({ id, changes: partial(fields) })) })
const removals = shape({ slug, ids: arr(id) })

// ---- reads -------------------------------------------------------------

export const listPagesFn = createServerFn()
  .validator(bySlug)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    return [...(await sql<Page[]>`
      select id, title, subtitle, position from pages where session_slug = ${s}`)]
  })

export const listSectionsFn = createServerFn()
  .validator(bySlug)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    return [...(await sql<Section[]>`
      select s.id, s.page_id, s.title, s.note, s.highlight, s.position
      from sections s join pages p on p.id = s.page_id
      where p.session_slug = ${s}`)]
  })

export const listTasksFn = createServerFn()
  .validator(bySlug)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    return [...(await sql<Task[]>`
      select t.id, t.section_id, s.page_id, t.text, t.done, t.badges, t.position
      from tasks t join sections s on s.id = t.section_id join pages p on p.id = s.page_id
      where p.session_slug = ${s}`)]
  })

// ---- pages -------------------------------------------------------------

export const insertPagesFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug, items: arr(shape({ id, ...pageFields })) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`insert into pages ${sql(data.items.map((p) => ({ ...p, sessionSlug: s })))}`
  })

export const updatePagesFn = createServerFn({ method: 'POST' })
  .validator(updates(pageFields))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const { id, changes } of data.items) {
        await tx`update pages set ${tx(changes as Record<string, any>)} where id = ${id} and session_slug = ${s}`
      }
    })
  })

export const deletePagesFn = createServerFn({ method: 'POST' })
  .validator(removals)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`delete from pages where id = any(${data.ids}) and session_slug = ${s}`
  })

// ---- sections ----------------------------------------------------------

export const insertSectionsFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug, items: arr(shape({ id, pageId: id, ...sectionFields })) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const x of data.items) {
        const [ok] = await tx`select 1 from pages where id = ${x.pageId} and session_slug = ${s}`
        if (!ok) throw new Error('NOT_FOUND')
        await tx`insert into sections ${tx(x)}`
      }
    })
  })

export const updateSectionsFn = createServerFn({ method: 'POST' })
  .validator(updates(sectionFields))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const { id, changes } of data.items) {
        await tx`update sections set ${tx(changes as Record<string, any>)}
          where id = ${id} and page_id in (select id from pages where session_slug = ${s})`
      }
    })
  })

export const deleteSectionsFn = createServerFn({ method: 'POST' })
  .validator(removals)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`delete from sections where id = any(${data.ids}) and page_id in (select id from pages where session_slug = ${s})`
  })

// ---- tasks -------------------------------------------------------------

// jsonb column: arrays must be wrapped or postgres.js sends them as a postgres array
const withJson = (sql: Awaited<ReturnType<typeof db>>, x: Record<string, any>) =>
  x.badges === undefined ? x : { ...x, badges: sql.json(x.badges) }

export const insertTasksFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug, items: arr(shape({ id, sectionId: id, ...taskFields })) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const x of data.items) {
        const [ok] = await tx`
          select 1 from sections sc join pages p on p.id = sc.page_id
          where sc.id = ${x.sectionId} and p.session_slug = ${s}`
        if (!ok) throw new Error('NOT_FOUND')
        await tx`insert into tasks ${tx(withJson(sql, x))}`
      }
    })
  })

export const updateTasksFn = createServerFn({ method: 'POST' })
  .validator(updates(taskFields))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const { id, changes } of data.items) {
        await tx`update tasks set ${tx(withJson(sql, changes))}
          where id = ${id} and section_id in (select sc.id from sections sc join pages p on p.id = sc.page_id where p.session_slug = ${s})`
      }
    })
  })

export const deleteTasksFn = createServerFn({ method: 'POST' })
  .validator(removals)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`delete from tasks where id = any(${data.ids}) and section_id in (select sc.id from sections sc join pages p on p.id = sc.page_id where p.session_slug = ${s})`
  })
````

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run build
grep -lE "scrypt|DATABASE_URL|pin_hash|COOKIE_SECRET" -r .output/public || echo "no server code in client bundle"
```

Expected: sem erros; última linha `no server code in client bundle`.

- [ ] **Step 6: Commit** — invocar a skill `auto-commit`.

---

### Task 3: Camada de dados do cliente (TanStack DB), router e root

**Files:**
- Create: `src/data/source.ts`, `src/data/source-context.tsx`, `src/data/actions.ts`, `src/data/theme.ts`, `src/data/recent.ts`, `src/components/toast.tsx`, `src/components/Shell.tsx`
- Modify: `src/router.tsx`, `src/routes/__root.tsx`

**Interfaces:**
- Consumes: server fns da Task 2.
- Produces:
  - `type Source = { slug: string | null; basePath: string; pages; sections; tasks; settings }` (cada um `Collection<T, string>`)
  - `getServerSource(qc, slug): Source`, `forgetServerSource(slug)`, `getLocalSource(): Source`, `queryKeys`, `listFns`
  - `SourceContext`, `useSource()`
  - `useActions()` → `addPage(title): id`, `updatePage`, `deletePage`, `movePage(sorted, id, dir)`, `addSection(pageId, title)`, `updateSection`, `deleteSection`, `moveSection`, `addTask(section, text)`, `updateTask(id, {text?, done?, badges?})`, `deleteTask`, `moveTask`, `setSettings({theme?, mode?})`
  - `useSettings(): Settings`, `useApplyTheme()`, `localThemeScript`
  - `readRecent()`, `rememberSession(slug)`, `forgetSession(slug)`
  - `ToastProvider`, `useToast(): (text, retry?) => void`
  - `Shell` (container 720px + aplica tema), `NotFound`

- [ ] **Step 1: Source** — `settings` no servidor usa o mesmo fluxo de `changes` das outras entidades (dentro do `onUpdate`, `collection.get()` devolve o valor sincronizado, não o otimista — por isso nunca ler a collection ali)

`src/data/source.ts`

````ts
import { createCollection, localStorageCollectionOptions, type Collection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/react-query'
import type { Page, Section, Settings, Task } from '#/lib/types'
import {
  deletePagesFn, deleteSectionsFn, deleteTasksFn, insertPagesFn, insertSectionsFn, insertTasksFn,
  listPagesFn, listSectionsFn, listTasksFn, updatePagesFn, updateSectionsFn, updateTasksFn,
} from '#/server/data'
import { getSettingsFn, updateSettingsFn } from '#/server/session'

export type Source = {
  slug: string | null
  basePath: string
  pages: Collection<Page, string>
  sections: Collection<Section, string>
  tasks: Collection<Task, string>
  settings: Collection<Settings, string>
}

type Fn<I> = (opts: { data: I }) => Promise<unknown>

// Query keys are shared with route loaders so SSR-prefetched data seeds the collections
export const queryKeys = {
  pages: (slug: string) => ['pages', slug],
  sections: (slug: string) => ['sections', slug],
  tasks: (slug: string) => ['tasks', slug],
  settings: (slug: string) => ['settings', slug],
}

export const listFns = { pages: listPagesFn, sections: listSectionsFn, tasks: listTasksFn, settings: getSettingsFn }

function serverCollection<T extends { id: string }>(
  qc: QueryClient,
  slug: string,
  name: keyof typeof queryKeys,
  fns: {
    insert?: Fn<{ slug: string; items: T[] }>
    update: Fn<{ slug: string; items: { id: string; changes: Partial<T> }[] }>
    remove?: Fn<{ slug: string; ids: string[] }>
  },
) {
  const list = listFns[name] as unknown as Fn<{ slug: string }>
  return createCollection(
    queryCollectionOptions({
      id: `${name}-${slug}`,
      queryKey: queryKeys[name](slug),
      queryFn: () => list({ data: { slug } }) as Promise<T[]>,
      queryClient: qc,
      getKey: (x: T) => x.id,
      refetchInterval: 15_000,
      onInsert: async ({ transaction }) => {
        await fns.insert?.({ data: { slug, items: transaction.mutations.map((m) => m.modified) } })
      },
      onUpdate: async ({ transaction }) => {
        await fns.update({
          data: { slug, items: transaction.mutations.map((m) => ({ id: m.key as string, changes: m.changes })) },
        })
      },
      onDelete: async ({ transaction }) => {
        await fns.remove?.({ data: { slug, ids: transaction.mutations.map((m) => m.key as string) } })
      },
    }),
  ) as unknown as Collection<T, string>
}

const serverSources = new Map<string, Source>()

export function getServerSource(qc: QueryClient, slug: string): Source {
  let source = serverSources.get(slug)
  if (!source) {
    source = {
      slug,
      basePath: `/s/${slug}`,
      pages: serverCollection<Page>(qc, slug, 'pages', { insert: insertPagesFn, update: updatePagesFn, remove: deletePagesFn }),
      sections: serverCollection<Section>(qc, slug, 'sections', { insert: insertSectionsFn, update: updateSectionsFn, remove: deleteSectionsFn }),
      tasks: serverCollection<Task>(qc, slug, 'tasks', { insert: insertTasksFn, update: updateTasksFn, remove: deleteTasksFn }),
      settings: serverCollection<Settings>(qc, slug, 'settings', {
        update: ({ data }) => updateSettingsFn({ data: { slug, changes: data.items[0].changes } }),
      }),
    }
    serverSources.set(slug, source)
  }
  return source
}

export function forgetServerSource(slug: string) {
  serverSources.delete(slug)
}

function localCollection<T extends { id: string }>(name: string) {
  return createCollection(
    localStorageCollectionOptions({ id: `local-${name}`, storageKey: `checklist-local-${name}`, getKey: (x: T) => x.id }),
  ) as unknown as Collection<T, string>
}

let localSource: Source | undefined

export function getLocalSource(): Source {
  localSource ??= {
    slug: null,
    basePath: '/local',
    pages: localCollection<Page>('pages'),
    sections: localCollection<Section>('sections'),
    tasks: localCollection<Task>('tasks'),
    settings: localCollection<Settings>('settings'),
  }
  return localSource
}
````

`src/data/source-context.tsx`

````tsx
import { createContext, useContext } from 'react'
import type { Source } from './source'

export const SourceContext = createContext<Source | null>(null)

export function useSource() {
  const source = useContext(SourceContext)
  if (!source) throw new Error('useSource outside SourceContext')
  return source
}
````

- [ ] **Step 2: Toast**

`src/components/toast.tsx`

````tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastItem = { id: number; text: string; retry?: () => void }
type Show = (text: string, retry?: () => void) => void

const ToastContext = createContext<Show>(() => {})
export const useToast = () => useContext(ToastContext)

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const show = useCallback<Show>(
    (text, retry) => {
      const id = ++seq
      setToasts((t) => [...t.slice(-2), { id, text, retry }])
      setTimeout(() => dismiss(id), 6000)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-ground shadow-lg">
            <span>{t.text}</span>
            {t.retry && (
              <button
                className="font-semibold underline underline-offset-2"
                onClick={() => {
                  dismiss(t.id)
                  t.retry?.()
                }}
              >
                Tentar de novo
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
````

- [ ] **Step 3: Ações otimistas** — deletar página/seção remove filhos explicitamente (o localStorage não tem cascade); 401 → `router.invalidate()` → tela de PIN

`src/data/actions.ts`

````ts
import { useRouter } from '@tanstack/react-router'
import type { Collection, Transaction } from '@tanstack/react-db'
import { newId } from '#/lib/id'
import type { Badge, Page, Section, Settings, Task } from '#/lib/types'
import { DEFAULT_SETTINGS } from '#/lib/types'
import { useToast } from '#/components/toast'
import { useSource } from './source-context'

type Positioned = { id: string; position: number }

const nextPosition = (items: Positioned[]) => items.reduce((max, x) => Math.max(max, x.position), 0) + 1

// Swap position with the neighbour in the given direction; one batch update = one server call/transaction
function swap<T extends Positioned>(collection: Collection<T, string>, sorted: T[], id: string, dir: -1 | 1) {
  const i = sorted.findIndex((x) => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return null
  const a = sorted[i]
  const b = sorted[j]
  const [pa, pb] = a.position === b.position ? [j, i] : [b.position, a.position]
  return collection.update([a.id, b.id], (drafts) => {
    drafts[0].position = pa
    drafts[1].position = pb
  })
}

export function useActions() {
  const source = useSource()
  const toast = useToast()
  const router = useRouter()

  // Every mutation is optimistic; on failure TanStack DB rolls back and we offer a retry
  const run = (mutate: () => Transaction | null) => {
    const tx = mutate()
    tx?.isPersisted.promise.catch((err: Error) => {
      if (err?.message === 'UNAUTHORIZED') {
        router.invalidate()
        return
      }
      toast('Não salvou', () => run(mutate))
    })
  }

  const { pages, sections, tasks, settings } = source
  const all = <T extends object>(c: Collection<T, string>) => [...c.values()]

  return {
    addPage(title: string) {
      const id = newId()
      run(() => pages.insert({ id, title, subtitle: '', position: nextPosition(all(pages)) }))
      return id
    },
    updatePage(id: string, changes: Partial<Omit<Page, 'id'>>) {
      run(() => pages.update(id, (d) => void Object.assign(d, changes)))
    },
    deletePage(id: string) {
      const sectionIds = all(sections).filter((s) => s.pageId === id).map((s) => s.id)
      const taskIds = all(tasks).filter((t) => t.pageId === id).map((t) => t.id)
      // Server cascades; local storage does not, so children are removed explicitly in both modes
      if (taskIds.length) run(() => tasks.delete(taskIds))
      if (sectionIds.length) run(() => sections.delete(sectionIds))
      run(() => pages.delete(id))
    },
    movePage(sorted: Page[], id: string, dir: -1 | 1) {
      run(() => swap(pages, sorted, id, dir))
    },

    addSection(pageId: string, title: string) {
      const siblings = all(sections).filter((s) => s.pageId === pageId)
      run(() => sections.insert({ id: newId(), pageId, title, note: '', highlight: false, position: nextPosition(siblings) }))
    },
    updateSection(id: string, changes: Partial<Pick<Section, 'title' | 'note' | 'highlight'>>) {
      run(() => sections.update(id, (d) => void Object.assign(d, changes)))
    },
    deleteSection(id: string) {
      const taskIds = all(tasks).filter((t) => t.sectionId === id).map((t) => t.id)
      if (taskIds.length) run(() => tasks.delete(taskIds))
      run(() => sections.delete(id))
    },
    moveSection(sorted: Section[], id: string, dir: -1 | 1) {
      run(() => swap(sections, sorted, id, dir))
    },

    addTask(section: Section, text: string) {
      const siblings = all(tasks).filter((t) => t.sectionId === section.id)
      run(() =>
        tasks.insert({
          id: newId(),
          sectionId: section.id,
          pageId: section.pageId,
          text,
          done: false,
          badges: [],
          position: nextPosition(siblings),
        }),
      )
    },
    updateTask(id: string, changes: Partial<Pick<Task, 'text' | 'done'>> & { badges?: Badge[] }) {
      run(() => tasks.update(id, (d) => void Object.assign(d, changes)))
    },
    deleteTask(id: string) {
      run(() => tasks.delete(id))
    },
    moveTask(sorted: Task[], id: string, dir: -1 | 1) {
      run(() => swap(tasks, sorted, id, dir))
    },

    setSettings(changes: Partial<Omit<Settings, 'id'>>) {
      if (settings.has('settings')) run(() => settings.update('settings', (d) => void Object.assign(d, changes)))
      else run(() => settings.insert({ ...DEFAULT_SETTINGS, ...changes }))
    },
  }
}
````

- [ ] **Step 4: Tema e recentes**

`src/data/theme.ts`

````ts
import { useEffect } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { DEFAULT_SETTINGS, type Settings } from '#/lib/types'
import { useSource } from './source-context'

export const LOCAL_THEME_KEY = 'checklist-theme'

// Runs before hydration on /local pages so the saved theme paints without a flash
export const localThemeScript = `try{if(location.pathname.startsWith('/local')){var t=JSON.parse(localStorage.getItem('${LOCAL_THEME_KEY}')||'null');if(t){document.documentElement.dataset.theme=t.theme;document.documentElement.dataset.mode=t.mode}}}catch(e){}`

export function useSettings(): Settings {
  const source = useSource()
  const { data } = useLiveQuery((q) => q.from({ s: source.settings }), [source])
  return data[0] ?? DEFAULT_SETTINGS
}

export function useApplyTheme() {
  const source = useSource()
  const { theme, mode } = useSettings()
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.mode = mode
    if (!source.slug) {
      try {
        localStorage.setItem(LOCAL_THEME_KEY, JSON.stringify({ theme, mode }))
      } catch {}
    }
  }, [theme, mode, source.slug])
}
````

`src/data/recent.ts`

````ts
const KEY = 'checklist-recent'

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {}
}

export const rememberSession = (slug: string) => write([slug, ...readRecent().filter((s) => s !== slug)].slice(0, 10))
export const forgetSession = (slug: string) => write(readRecent().filter((s) => s !== slug))
````

`src/components/Shell.tsx`

````tsx
import type { ReactNode } from 'react'
import { useApplyTheme } from '#/data/theme'

export function Shell({ children }: { children: ReactNode }) {
  useApplyTheme()
  return <div className="mx-auto max-w-[720px] px-4 pb-12">{children}</div>
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-[720px] px-4 pt-24 text-center">
      <h1 className="text-2xl font-extrabold">Não encontrado</h1>
      <a href="/" className="mt-4 inline-block text-accent underline">
        Voltar ao início
      </a>
    </div>
  )
}
````

- [ ] **Step 5: Router e root** — root loader resolve o tema de `/s/<slug>` no servidor (primeira pintura já tematizada)

`src/router.tsx`

````tsx
import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { NotFound } from './components/Shell'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true } },
  })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
````

`src/routes/__root.tsx`

````tsx
import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ToastProvider } from '#/components/toast'
import { localThemeScript } from '#/data/theme'
import { themeFn } from '#/server/session'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Theme for /s/<slug> is resolved on the server so the first paint is already themed
  loader: async ({ location }) => {
    const m = location.pathname.match(/^\/s\/([a-z0-9]{3,40})/)
    return m ? await themeFn({ data: { slug: m[1] } }) : null
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Checklist' },
    ],
    links: [
      {
        rel: 'icon',
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✅</text></svg>",
      },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
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
    <html lang="pt-BR" data-theme={theme?.theme ?? 'roxo'} data-mode={theme?.mode ?? 'system'} suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: localThemeScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
````

- [ ] **Step 6: Verificar**

```bash
npm run generate-routes && npm run typecheck
```

Expected: sem erros (`src/routes/index.tsx` do scaffold ainda existe e compila).

- [ ] **Step 7: Commit** — invocar a skill `auto-commit`.

---

### Task 4: Componentes de UI

**Files:**
- Create: `src/components/Popover.tsx`, `src/components/InlineEdit.tsx`, `src/components/ProgressBar.tsx`, `src/components/Badge.tsx`, `src/components/VoiceButton.tsx`, `src/components/TaskRow.tsx`, `src/components/SectionCard.tsx`, `src/components/Settings.tsx`, `src/components/PinGate.tsx`

**Interfaces:**
- Consumes: `useActions`, `useSource`, `useSettings`, `forgetServerSource`, `forgetSession`, `loginFn`, `deleteSessionFn`, tipos/constantes.
- Produces:
  - `Popover({ trigger: (p: TriggerProps) => ReactNode, children: (close) => ReactNode, className? })`, `Menu({label, children})`, `MenuItem({onClick, children, danger?})`
  - `InlineEdit({ value, onSave, placeholder?, className?, multiline?, required?, maxLength?, startEditing?, onDone? })`
  - `ProgressBar({ done, total, small? })`
  - `BadgeChip({ badge, ...buttonProps })`, `BadgeEditor({ initial?, onSave, onRemove? })`
  - `VoiceButton({ value, onChange })`
  - `TaskRow({ task, siblings })`, `NewTaskInput({ section })`, `SectionCard({ section, index, siblings, tasks })`
  - `SettingsButton()`, `PinGate({ slug })`

- [ ] **Step 1: Primitivos**

`src/components/Popover.tsx`

````tsx
import { useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

export type TriggerProps = {
  ref: RefObject<HTMLButtonElement | null>
  popoverTarget: string
  type: 'button'
}

// Native popover API (top layer + light dismiss); positioned next to the trigger by hand
// ponytail: fixed position is computed on open only; switch to CSS anchor positioning once Firefox ships it
export function Popover({
  trigger,
  children,
  className = '',
}: {
  trigger: (props: TriggerProps) => ReactNode
  children: (close: () => void) => ReactNode
  className?: string
}) {
  const id = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    const b = btn.current
    const p = pop.current
    if (!open || !b || !p) return
    const r = b.getBoundingClientRect()
    const left = Math.max(8, Math.min(r.right - p.offsetWidth, innerWidth - p.offsetWidth - 8))
    const below = r.bottom + 4
    const top = below + p.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - p.offsetHeight - 4) : below
    p.style.left = `${left}px`
    p.style.top = `${top}px`
  }, [open])

  return (
    <>
      {trigger({ ref: btn, popoverTarget: id, type: 'button' })}
      <div
        ref={pop}
        id={id}
        popover="auto"
        className={`fixed max-w-[calc(100vw-16px)] text-sm ${className}`}
        onToggle={(e) => setOpen(e.newState === 'open')}
      >
        {open && children(() => pop.current?.hidePopover())}
      </div>
    </>
  )
}

export function Menu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  return (
    <Popover
      className="min-w-48 p-1"
      trigger={(p) => (
        <button
          {...p}
          aria-label={label}
          className="-my-1.5 grid size-9 shrink-0 place-items-center rounded-lg text-lg leading-none text-ink-soft hover:bg-accent-soft hover:text-accent"
        >
          ⋯
        </button>
      )}
    >
      {children}
    </Popover>
  )
}

export function MenuItem({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-accent-soft disabled:opacity-40 ${danger ? 'text-warn' : ''}`}
    >
      {children}
    </button>
  )
}
````

`src/components/InlineEdit.tsx`

````tsx
import { useRef, useState } from 'react'

// Click to edit; Enter or blur saves, Esc cancels. Empty value is ignored when `required`.
export function InlineEdit({
  value,
  onSave,
  placeholder = '',
  className = '',
  multiline = false,
  required = false,
  maxLength,
  startEditing = false,
  onDone,
}: {
  value: string
  onSave: (value: string) => void
  placeholder?: string
  className?: string
  multiline?: boolean
  required?: boolean
  maxLength?: number
  startEditing?: boolean
  onDone?: () => void
}) {
  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState(value)
  const cancelled = useRef(false)

  if (!editing) {
    return (
      <button
        type="button"
        className={`inline cursor-text text-left break-words ${className}`}
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value || <span className="text-ink-soft opacity-70">{placeholder}</span>}
      </button>
    )
  }

  const commit = () => {
    setEditing(false)
    onDone?.()
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    const v = draft.trim()
    if (v !== value && (v || !required)) onSave(v)
  }

  const props = {
    autoFocus: true,
    value: draft,
    maxLength,
    placeholder,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        cancelled.current = true
        e.currentTarget.blur()
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        e.currentTarget.blur()
      }
    },
    className: `block w-full rounded-md bg-accent-soft/60 px-1 -mx-1 outline-2 outline-accent/40 ${className}`,
  }

  return multiline ? <textarea rows={1} {...props} className={`${props.className} resize-none field-sizing-content`} /> : <input {...props} />
}
````

`src/components/ProgressBar.tsx`

````tsx
export function ProgressBar({ done, total, small = false }: { done: number; total: number; small?: boolean }) {
  const pct = total ? (done / total) * 100 : 0
  return (
    <div className="flex items-center gap-2.5">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className={`flex-1 overflow-hidden rounded-full bg-line ${small ? 'h-1.5' : 'h-2'}`}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-250 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-bold whitespace-nowrap text-accent tabular-nums ${small ? 'text-xs' : 'text-[0.82rem]'}`}>
        {done}/{total}
      </span>
    </div>
  )
}
````

`src/components/Badge.tsx`

````tsx
import { useState, type ComponentProps, type FormEvent } from 'react'
import { BADGE_COLORS, LIMITS, type Badge } from '#/lib/types'

// Tinted from the badge colour against the current surface/ink, so it works in light and dark
const tint = (color: string) => ({
  background: `color-mix(in oklab, ${color} 16%, var(--surface))`,
  color: `color-mix(in oklab, ${color} 80%, var(--ink))`,
})

export function BadgeChip({ badge, className = '', ...props }: { badge: Badge } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      style={tint(badge.color)}
      className={`inline-block rounded-md px-1.5 py-px align-[1px] text-[0.68rem] font-bold tracking-[.03em] ${className}`}
    >
      {badge.text}
    </button>
  )
}

export function BadgeEditor({
  initial,
  onSave,
  onRemove,
}: {
  initial?: Badge
  onSave: (badge: Badge) => void
  onRemove?: () => void
}) {
  const [text, setText] = useState(initial?.text ?? '')
  const [color, setColor] = useState(initial?.color ?? BADGE_COLORS[0])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    if (t) onSave({ text: t, color })
  }
  const custom = !BADGE_COLORS.includes(color)

  return (
    <form onSubmit={submit} className="w-64 space-y-3 p-3">
      <input
        autoFocus
        value={text}
        maxLength={LIMITS.badgeText}
        onChange={(e) => setText(e.target.value)}
        placeholder="Texto do badge"
        className="w-full rounded-lg border border-line bg-ground px-3 py-2 outline-none focus:border-accent"
      />
      <div className="flex flex-wrap gap-2">
        {BADGE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Cor ${c}`}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className="size-7 rounded-full ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
            style={{ background: c }}
          />
        ))}
        <label
          title="Cor personalizada"
          className={`relative size-7 cursor-pointer overflow-hidden rounded-full ring-offset-2 ring-offset-surface ${custom ? 'ring-2 ring-ink' : ''}`}
          style={{ background: custom ? color : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
        >
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span style={tint(color)} className="rounded-md px-1.5 py-px text-[0.68rem] font-bold tracking-[.03em]">
          {text.trim() || 'prévia'}
        </span>
        <div className="flex gap-2">
          {onRemove && (
            <button type="button" onClick={onRemove} className="rounded-lg px-3 py-1.5 text-warn hover:bg-warn-soft">
              Remover
            </button>
          )}
          <button disabled={!text.trim()} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-surface disabled:opacity-40">
            Salvar
          </button>
        </div>
      </div>
    </form>
  )
}
````

`src/components/VoiceButton.tsx`

````tsx
import { useEffect, useRef, useState } from 'react'

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

const getRecognition = () => {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as Record<string, (new () => Recognition) | undefined>
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

// Web Speech API dictation; renders nothing where unsupported (e.g. Firefox)
export function VoiceButton({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)

  useEffect(() => {
    setSupported(!!getRecognition())
    return () => rec.current?.stop()
  }, [])

  if (!supported) return null

  const toggle = () => {
    if (listening) {
      rec.current?.stop()
      return
    }
    const R = getRecognition()!
    const r = new R()
    const base = value.trim()
    r.lang = 'pt-BR'
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => {
      const said = Array.from(e.results, (res) => res[0].transcript).join('')
      onChange(base ? `${base} ${said}` : said)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    r.start()
    setListening(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? 'Parar ditado' : 'Ditar tarefa'}
      className={`grid size-9 shrink-0 place-items-center rounded-lg ${listening ? 'animate-pulse bg-accent-soft' : 'opacity-70 hover:opacity-100'}`}
    >
      🎤
    </button>
  )
}
````

- [ ] **Step 2: Tarefa e seção**

`src/components/TaskRow.tsx`

````tsx
import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { LIMITS, type Badge, type Section, type Task } from '#/lib/types'
import { BadgeChip, BadgeEditor } from './Badge'
import { InlineEdit } from './InlineEdit'
import { Menu, MenuItem, Popover } from './Popover'
import { VoiceButton } from './VoiceButton'

export function TaskRow({ task, siblings }: { task: Task; siblings: Task[] }) {
  const a = useActions()
  const [addingBadge, setAddingBadge] = useState(false)
  const setBadges = (badges: Badge[]) => a.updateTask(task.id, { badges })

  return (
    <div className="flex items-start gap-2.5 border-t border-line py-2 pl-1 first:border-t-0">
      <label className="-m-2.5 cursor-pointer p-2.5">
        <input
          type="checkbox"
          className="check"
          checked={task.done}
          onChange={(e) => a.updateTask(task.id, { done: e.target.checked })}
          aria-label="Concluída"
        />
      </label>
      <div className="min-w-0 flex-1 text-[0.92rem] leading-[1.42]">
        <InlineEdit
          value={task.text}
          required
          multiline
          maxLength={LIMITS.task}
          onSave={(text) => a.updateTask(task.id, { text })}
          className={task.done ? 'text-ink-soft line-through decoration-line' : ''}
        />
        {task.badges.map((b, j) => (
          <Popover key={j} trigger={(p) => <BadgeChip {...p} badge={b} className="ml-1.5" />}>
            {(close) => (
              <BadgeEditor
                initial={b}
                onSave={(nb) => {
                  setBadges(task.badges.map((x, k) => (k === j ? nb : x)))
                  close()
                }}
                onRemove={() => {
                  setBadges(task.badges.filter((_, k) => k !== j))
                  close()
                }}
              />
            )}
          </Popover>
        ))}
      </div>
      <Menu label="Ações da tarefa">
        {(close) =>
          addingBadge ? (
            <BadgeEditor
              onSave={(b) => {
                setBadges([...task.badges, b])
                setAddingBadge(false)
                close()
              }}
            />
          ) : (
            <>
              <MenuItem onClick={() => (a.moveTask(siblings, task.id, -1), close())}>↑ Subir</MenuItem>
              <MenuItem onClick={() => (a.moveTask(siblings, task.id, 1), close())}>↓ Descer</MenuItem>
              {task.badges.length < LIMITS.badges && <MenuItem onClick={() => setAddingBadge(true)}>＋ Badge</MenuItem>}
              <MenuItem danger onClick={() => (a.deleteTask(task.id), close())}>
                Deletar
              </MenuItem>
            </>
          )
        }
      </Menu>
    </div>
  )
}

export function NewTaskInput({ section }: { section: Section }) {
  const a = useActions()
  const [text, setText] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    a.addTask(section, v)
    setText('')
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-line py-1.5 pl-[33px]">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={LIMITS.task}
        placeholder="+ nova tarefa"
        aria-label="Nova tarefa"
        className="min-w-0 flex-1 bg-transparent py-1.5 text-[0.92rem] outline-none placeholder:text-ink-soft"
      />
      <VoiceButton value={text} onChange={setText} />
    </form>
  )
}
````

`src/components/SectionCard.tsx`

````tsx
import { useState } from 'react'
import { useActions } from '#/data/actions'
import { LIMITS, type Section, type Task } from '#/lib/types'
import { InlineEdit } from './InlineEdit'
import { Menu, MenuItem } from './Popover'
import { NewTaskInput, TaskRow } from './TaskRow'

export function SectionCard({
  section,
  index,
  siblings,
  tasks,
}: {
  section: Section
  index: number
  siblings: Section[]
  tasks: Task[]
}) {
  const a = useActions()
  const [editingNote, setEditingNote] = useState(false)

  return (
    <section
      className={`mb-3.5 rounded-2xl border px-[18px] pt-[18px] pb-2 ${
        section.highlight ? 'border-transparent bg-warn-soft' : 'border-line bg-surface'
      }`}
    >
      <div className="mb-2.5 flex items-baseline gap-2">
        <span className={`font-display text-[0.85rem] font-extrabold ${section.highlight ? 'text-warn' : 'text-accent'}`}>
          {index + 1}
        </span>
        <h2 className="m-0 min-w-0 flex-1 text-[1.02rem] font-bold">
          <InlineEdit
            value={section.title}
            required
            maxLength={LIMITS.title}
            onSave={(title) => a.updateSection(section.id, { title })}
          />
        </h2>
        <Menu label="Ações da seção">
          {(close) => (
            <>
              <MenuItem onClick={() => (a.moveSection(siblings, section.id, -1), close())}>↑ Subir</MenuItem>
              <MenuItem onClick={() => (a.moveSection(siblings, section.id, 1), close())}>↓ Descer</MenuItem>
              <MenuItem onClick={() => (a.updateSection(section.id, { highlight: !section.highlight }), close())}>
                {section.highlight ? 'Remover destaque' : 'Destacar'}
              </MenuItem>
              <MenuItem onClick={() => (setEditingNote(true), close())}>{section.note ? 'Editar nota' : 'Adicionar nota'}</MenuItem>
              <MenuItem
                danger
                onClick={() => {
                  close()
                  if (confirm(`Deletar a seção "${section.title}" e suas tarefas?`)) a.deleteSection(section.id)
                }}
              >
                Deletar
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
      {(section.note || editingNote) && (
        <div className="-mt-1 mb-2.5 text-[0.82rem] text-ink-soft">
          <InlineEdit
            key={String(editingNote)}
            value={section.note}
            multiline
            placeholder="Nota da seção"
            maxLength={LIMITS.note}
            startEditing={editingNote}
            onDone={() => setEditingNote(false)}
            onSave={(note) => a.updateSection(section.id, { note })}
          />
        </div>
      )}
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} siblings={tasks} />
      ))}
      <NewTaskInput section={section} />
    </section>
  )
}
````

- [ ] **Step 3: Configurações e PIN**

`src/components/Settings.tsx`

````tsx
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { forgetSession } from '#/data/recent'
import { forgetServerSource } from '#/data/source'
import { useSource } from '#/data/source-context'
import { useSettings } from '#/data/theme'
import { MODES, THEMES } from '#/lib/types'
import { deleteSessionFn } from '#/server/session'
import { Popover } from './Popover'

const label = 'mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase'

export function SettingsButton() {
  const source = useSource()
  return (
    <Popover
      className="w-72 space-y-4 p-3"
      trigger={(p) => (
        <button {...p} aria-label="Configurações" className="grid size-10 place-items-center rounded-xl text-xl text-ink-soft hover:bg-accent-soft hover:text-accent">
          ⚙
        </button>
      )}
    >
      {() => (
        <>
          <ThemePicker />
          {source.slug && <ShareLink slug={source.slug} />}
          {source.slug && <DeleteSession slug={source.slug} />}
        </>
      )}
    </Popover>
  )
}

function ThemePicker() {
  const { theme, mode } = useSettings()
  const a = useActions()
  return (
    <>
      <div>
        <p className={label}>Tema</p>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={theme === t.id}
              onClick={() => a.setSettings({ theme: t.id })}
              className="size-8 rounded-full ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
              style={{ background: t.swatch }}
            />
          ))}
        </div>
      </div>
      <div>
        <p className={label}>Modo</p>
        <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-line p-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => a.setSettings({ mode: m.id })}
              className="rounded-md py-1.5 aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent"
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function ShareLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(`${location.origin}/s/${slug}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="w-full rounded-lg border border-line py-2 font-semibold hover:bg-accent-soft"
    >
      {copied ? 'Link copiado ✓' : 'Copiar link da sessão'}
    </button>
  )
}

function DeleteSession({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await deleteSessionFn({ data: { slug, pin, confirm } })
      if (!r.ok) {
        setError(r.reason === 'pin' ? 'PIN incorreto' : 'Digite o slug exatamente')
        return
      }
      forgetSession(slug)
      forgetServerSource(slug)
      queryClient.removeQueries({ predicate: (q) => q.queryKey[1] === slug })
      navigate({ to: '/' })
    } catch {
      setError('Confira o slug e o PIN')
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-lg border border-line bg-ground px-3 py-2 outline-none focus:border-warn'
  return (
    <details className="rounded-lg border border-line p-2">
      <summary className="cursor-pointer font-semibold text-warn">Deletar sessão</summary>
      <form onSubmit={submit} className="mt-2 space-y-2">
        <p className="text-xs text-ink-soft">Apaga todas as páginas desta sessão. Não dá para desfazer.</p>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Digite "${slug}"`} className={input} />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          placeholder="PIN"
          className={input}
        />
        {error && <p role="alert" className="text-xs text-warn">{error}</p>}
        <button
          disabled={busy || confirm !== slug || pin.length !== 4}
          className="w-full rounded-lg bg-warn py-2 font-semibold text-surface disabled:opacity-40"
        >
          Deletar para sempre
        </button>
      </form>
    </details>
  )
}
````

`src/components/PinGate.tsx`

````tsx
import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { loginFn } from '#/server/session'

export function PinGate({ slug }: { slug: string }) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (value: string) => {
    setBusy(true)
    setError('')
    try {
      const r = await loginFn({ data: { slug, pin: value } })
      if (r.ok) {
        await router.invalidate()
        return
      }
      setPin('')
      setError(
        r.reason === 'locked'
          ? `Muitas tentativas. Tente de novo às ${new Date(r.until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
          : 'PIN incorreto.',
      )
    } catch {
      setError('Não foi possível conectar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 pt-24 text-center">
      <h1 className="m-0 text-2xl font-extrabold">{slug}</h1>
      <p className="mt-1 text-[0.9rem] text-ink-soft">Digite o PIN de 4 dígitos</p>
      <input
        autoFocus
        value={pin}
        disabled={busy}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="PIN"
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
          setPin(v)
          if (v.length === 4) submit(v)
        }}
        className="mt-6 w-full rounded-2xl border border-line bg-surface py-4 text-center font-display text-3xl font-extrabold tracking-[0.6em] outline-none focus:border-accent"
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-warn">
          {error}
        </p>
      )}
      <Link to="/" className="mt-8 inline-block text-sm text-ink-soft hover:text-accent">
        ← Início
      </Link>
    </div>
  )
}
````

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
```

Expected: sem erros.

- [ ] **Step 5: Commit** — invocar a skill `auto-commit`.

---

### Task 5: Views, rotas e verificação E2E

**Files:**
- Create: `src/components/links.tsx`, `src/components/ChecklistView.tsx`, `src/components/PagesView.tsx`, `src/routes/local.tsx`, `src/routes/local.index.tsx`, `src/routes/local.p.$pageId.tsx`, `src/routes/s.$slug.tsx`, `src/routes/s.$slug.index.tsx`, `src/routes/s.$slug.p.$pageId.tsx`
- Modify: `src/routes/index.tsx` (substituir o do scaffold), `src/routeTree.gen.ts` (gerado)

**Interfaces:**
- Consumes: tudo das Tasks 2–4.
- Produces: rotas `/`, `/local`, `/local/p/$pageId`, `/s/$slug`, `/s/$slug/p/$pageId`.

- [ ] **Step 1: Links tipados e views**

`src/components/links.tsx`

````tsx
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { Source } from '#/data/source'

// Same UI serves /local and /s/$slug; these keep the typed router links in one place
export function PageLink({ source, pageId, className, children }: { source: Source; pageId: string; className?: string; children: ReactNode }) {
  return source.slug ? (
    <Link to="/s/$slug/p/$pageId" params={{ slug: source.slug, pageId }} className={className}>
      {children}
    </Link>
  ) : (
    <Link to="/local/p/$pageId" params={{ pageId }} className={className}>
      {children}
    </Link>
  )
}

export function PagesLink({ source, className, children }: { source: Source; className?: string; children: ReactNode }) {
  return source.slug ? (
    <Link to="/s/$slug" params={{ slug: source.slug }} className={className}>
      {children}
    </Link>
  ) : (
    <Link to="/local" className={className}>
      {children}
    </Link>
  )
}
````

`src/components/ChecklistView.tsx`

````tsx
import { eq, useLiveQuery } from '@tanstack/react-db'
import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { useSource } from '#/data/source-context'
import { LIMITS, type Task } from '#/lib/types'
import { InlineEdit } from './InlineEdit'
import { PagesLink } from './links'
import { ProgressBar } from './ProgressBar'
import { SectionCard } from './SectionCard'
import { NotFound } from './Shell'

export function ChecklistView({ pageId }: { pageId: string }) {
  const source = useSource()
  const a = useActions()
  const { data: pages, isReady } = useLiveQuery((q) => q.from({ p: source.pages }).where(({ p }) => eq(p.id, pageId)), [source, pageId])
  const { data: sections } = useLiveQuery(
    (q) => q.from({ s: source.sections }).where(({ s }) => eq(s.pageId, pageId)).orderBy(({ s }) => s.position),
    [source, pageId],
  )
  const { data: tasks } = useLiveQuery(
    (q) => q.from({ t: source.tasks }).where(({ t }) => eq(t.pageId, pageId)).orderBy(({ t }) => t.position),
    [source, pageId],
  )

  const page = pages[0]
  if (!page) return isReady ? <NotFound /> : null

  const bySection = new Map<string, Task[]>()
  for (const t of tasks) bySection.set(t.sectionId, [...(bySection.get(t.sectionId) ?? []), t])
  const done = tasks.filter((t) => t.done).length

  return (
    <>
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 bg-ground pt-6 pb-3.5">
        <PagesLink source={source} className="mb-2 inline-block text-sm text-ink-soft hover:text-accent">
          ← Páginas
        </PagesLink>
        <h1 className="m-0 mb-1 text-2xl font-extrabold tracking-[-0.01em]">
          <InlineEdit value={page.title} required maxLength={LIMITS.title} onSave={(title) => a.updatePage(page.id, { title })} />
        </h1>
        <p className="m-0 mb-3.5 text-[0.9rem] text-ink-soft">
          <InlineEdit
            value={page.subtitle}
            placeholder="Adicionar subtítulo"
            maxLength={LIMITS.title}
            onSave={(subtitle) => a.updatePage(page.id, { subtitle })}
          />
        </p>
        <ProgressBar done={done} total={tasks.length} />
      </header>
      <main>
        {sections.map((s, i) => (
          <SectionCard key={s.id} section={s} index={i} siblings={sections} tasks={bySection.get(s.id) ?? []} />
        ))}
        <NewSection onAdd={(title) => a.addSection(page.id, title)} />
      </main>
      <footer className="pt-2 text-center text-[0.78rem] text-ink-soft">
        {source.slug ? `Sincronizado na sessão ${source.slug}.` : 'Salvo só neste navegador.'}
      </footer>
    </>
  )
}

function NewSection({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = title.trim()
    if (!v) return
    onAdd(v)
    setTitle('')
  }
  return (
    <form onSubmit={submit} className="mb-3.5 flex gap-2 rounded-2xl border border-dashed border-line p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={LIMITS.title}
        placeholder="+ nova seção"
        aria-label="Nova seção"
        className="min-w-0 flex-1 bg-transparent px-2 py-2 font-display font-bold outline-none placeholder:text-ink-soft"
      />
      {title.trim() && <button className="rounded-xl bg-accent px-4 font-semibold text-surface">Criar</button>}
    </form>
  )
}
````

`src/components/PagesView.tsx`

````tsx
import { useLiveQuery } from '@tanstack/react-db'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { useSource } from '#/data/source-context'
import { LIMITS } from '#/lib/types'
import { PageLink } from './links'
import { Menu, MenuItem } from './Popover'
import { ProgressBar } from './ProgressBar'
import { SettingsButton } from './Settings'

export function PagesView() {
  const source = useSource()
  const a = useActions()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const { data: pages } = useLiveQuery((q) => q.from({ p: source.pages }).orderBy(({ p }) => p.position), [source])
  const { data: tasks } = useLiveQuery((q) => q.from({ t: source.tasks }), [source])

  const stats = new Map<string, { done: number; total: number }>()
  for (const t of tasks) {
    const s = stats.get(t.pageId) ?? { done: 0, total: 0 }
    s.total++
    if (t.done) s.done++
    stats.set(t.pageId, s)
  }

  const create = (e: FormEvent) => {
    e.preventDefault()
    const v = title.trim()
    if (!v) return
    const pageId = a.addPage(v)
    setTitle('')
    if (source.slug) navigate({ to: '/s/$slug/p/$pageId', params: { slug: source.slug, pageId } })
    else navigate({ to: '/local/p/$pageId', params: { pageId } })
  }

  return (
    <>
      <header className="flex items-start justify-between gap-3 pt-6 pb-4">
        <div>
          <a href="/" className="mb-2 inline-block text-sm text-ink-soft hover:text-accent">
            ← Início
          </a>
          <h1 className="m-0 text-2xl font-extrabold tracking-[-0.01em]">{source.slug ?? 'Sem salvar'}</h1>
          <p className="m-0 mt-1 text-[0.9rem] text-ink-soft">
            {source.slug ? 'Sessão sincronizada' : 'Dados só neste navegador'}
          </p>
        </div>
        <SettingsButton />
      </header>
      <main className="space-y-2.5">
        {pages.map((p) => {
          const s = stats.get(p.id) ?? { done: 0, total: 0 }
          return (
            <div key={p.id} className="flex items-start gap-2 rounded-2xl border border-line bg-surface p-4">
              <PageLink source={source} pageId={p.id} className="min-w-0 flex-1">
                <h2 className="m-0 text-[1.02rem] font-bold">{p.title}</h2>
                {p.subtitle && <p className="m-0 mt-0.5 truncate text-[0.82rem] text-ink-soft">{p.subtitle}</p>}
                <div className="mt-3">
                  <ProgressBar small done={s.done} total={s.total} />
                </div>
              </PageLink>
              <Menu label="Ações da página">
                {(close) => (
                  <>
                    <MenuItem onClick={() => (a.movePage(pages, p.id, -1), close())}>↑ Subir</MenuItem>
                    <MenuItem onClick={() => (a.movePage(pages, p.id, 1), close())}>↓ Descer</MenuItem>
                    <MenuItem
                      danger
                      onClick={() => {
                        close()
                        if (confirm(`Deletar a página "${p.title}"?`)) a.deletePage(p.id)
                      }}
                    >
                      Deletar
                    </MenuItem>
                  </>
                )}
              </Menu>
            </div>
          )
        })}
        <form onSubmit={create} className="flex gap-2 rounded-2xl border border-dashed border-line p-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.title}
            placeholder="+ nova página"
            aria-label="Nova página"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 font-display font-bold outline-none placeholder:text-ink-soft"
          />
          {title.trim() && <button className="rounded-xl bg-accent px-4 font-semibold text-surface">Criar</button>}
        </form>
      </main>
    </>
  )
}
````

- [ ] **Step 2: Home**

`src/routes/index.tsx`

````tsx
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { readRecent } from '#/data/recent'
import { PIN_RE, SLUG_RE } from '#/lib/id'
import { checkSlugFn, createSessionFn } from '#/server/session'

export const Route = createFileRoute('/')({ component: Home })

const card = 'rounded-2xl border border-line bg-surface p-5'
const input = 'w-full rounded-xl border border-line bg-ground px-3 py-2.5 outline-none focus:border-accent'
const button = 'w-full rounded-xl bg-accent py-2.5 font-semibold text-surface disabled:opacity-40'
const onlySlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
const onlyPin = (v: string) => v.replace(/\D/g, '').slice(0, 4)

function Home() {
  const [recent, setRecent] = useState<string[]>([])
  useEffect(() => setRecent(readRecent()), [])

  return (
    <div className="mx-auto max-w-[720px] space-y-3.5 px-4 pt-10 pb-12">
      <header className="mb-6">
        <h1 className="m-0 text-3xl font-extrabold tracking-[-0.01em]">Checklist</h1>
        <p className="m-0 mt-1 text-ink-soft">Listas simples, sincronizadas entre celular e PC.</p>
      </header>

      {recent.length > 0 && (
        <section className={card}>
          <h2 className="m-0 mb-3 text-base font-bold">Neste aparelho</h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((slug) => (
              <Link key={slug} to="/s/$slug" params={{ slug }} className="rounded-lg bg-accent-soft px-3 py-1.5 font-semibold text-accent">
                {slug}
              </Link>
            ))}
          </div>
        </section>
      )}

      <CreateSession />
      <EnterSession />

      <section className={card}>
        <h2 className="m-0 text-base font-bold">Usar sem salvar</h2>
        <p className="mt-1 mb-3 text-sm text-ink-soft">Fica só neste navegador, sem sincronizar.</p>
        <Link to="/local" className="inline-block rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-accent-soft">
          Abrir modo anônimo
        </Link>
      </section>
    </div>
  )
}

function CreateSession() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!SLUG_RE.test(slug)) return setStatus('idle')
    let alive = true
    setStatus('checking')
    const t = setTimeout(async () => {
      const r = await checkSlugFn({ data: { slug } }).catch(() => null)
      if (alive && r) setStatus(r.available ? 'free' : 'taken')
    }, 400)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [slug])

  const valid = SLUG_RE.test(slug) && PIN_RE.test(pin) && pin === pin2 && status !== 'taken'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await createSessionFn({ data: { slug, pin } })
      if (!r.ok) {
        setStatus('taken')
        return
      }
      navigate({ to: '/s/$slug', params: { slug } })
    } catch {
      setError('Não foi possível criar a sessão.')
    } finally {
      setBusy(false)
    }
  }

  const hint = {
    idle: 'Só letras minúsculas e números, 3 a 40 caracteres. Não pode ser alterado depois.',
    checking: 'Verificando…',
    free: 'Disponível ✓',
    taken: 'Esse slug já existe.',
  }[status]

  return (
    <section className={card}>
      <h2 className="m-0 mb-3 text-base font-bold">Criar sessão</h2>
      <form onSubmit={submit} className="space-y-2.5">
        <input value={slug} onChange={(e) => setSlug(onlySlug(e.target.value))} placeholder="slug (ex: listadamaria)" aria-label="Slug" className={input} />
        <p className={`m-0 text-xs ${status === 'taken' ? 'text-warn' : status === 'free' ? 'text-done' : 'text-ink-soft'}`}>{hint}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <input value={pin} onChange={(e) => setPin(onlyPin(e.target.value))} inputMode="numeric" placeholder="PIN (4 dígitos)" aria-label="PIN" className={input} />
          <input value={pin2} onChange={(e) => setPin2(onlyPin(e.target.value))} inputMode="numeric" placeholder="Repita o PIN" aria-label="Repita o PIN" className={input} />
        </div>
        {pin2.length === 4 && pin !== pin2 && <p className="m-0 text-xs text-warn">Os PINs não conferem.</p>}
        {error && <p role="alert" className="m-0 text-xs text-warn">{error}</p>}
        <button disabled={!valid || busy} className={button}>
          Criar
        </button>
      </form>
    </section>
  )
}

function EnterSession() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (SLUG_RE.test(slug)) navigate({ to: '/s/$slug', params: { slug } })
  }
  return (
    <section className={card}>
      <h2 className="m-0 mb-3 text-base font-bold">Entrar em uma sessão</h2>
      <form onSubmit={submit} className="flex gap-2.5">
        <input value={slug} onChange={(e) => setSlug(onlySlug(e.target.value))} placeholder="slug" aria-label="Slug da sessão" className={input} />
        <button disabled={!SLUG_RE.test(slug)} className="rounded-xl bg-accent px-5 font-semibold text-surface disabled:opacity-40">
          Entrar
        </button>
      </form>
    </section>
  )
}
````

- [ ] **Step 3: Rotas do modo anônimo** (`ssr: false`)

`src/routes/local.tsx`

````tsx
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Shell } from '#/components/Shell'
import { getLocalSource } from '#/data/source'
import { SourceContext } from '#/data/source-context'

// localStorage only exists in the browser
export const Route = createFileRoute('/local')({ ssr: false, component: LocalLayout })

function LocalLayout() {
  return (
    <SourceContext.Provider value={getLocalSource()}>
      <Shell>
        <Outlet />
      </Shell>
    </SourceContext.Provider>
  )
}
````

`src/routes/local.index.tsx`

````tsx
import { createFileRoute } from '@tanstack/react-router'
import { PagesView } from '#/components/PagesView'

export const Route = createFileRoute('/local/')({ component: PagesView })
````

`src/routes/local.p.$pageId.tsx`

````tsx
import { createFileRoute } from '@tanstack/react-router'
import { ChecklistView } from '#/components/ChecklistView'

export const Route = createFileRoute('/local/p/$pageId')({ component: Page })

function Page() {
  const { pageId } = Route.useParams()
  return <ChecklistView pageId={pageId} />
}
````

- [ ] **Step 4: Rotas da sessão** (`ssr: 'data-only'`)

`src/routes/s.$slug.tsx`

````tsx
import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { useEffect } from 'react'
import { PinGate } from '#/components/PinGate'
import { Shell } from '#/components/Shell'
import { rememberSession } from '#/data/recent'
import { getServerSource, listFns, queryKeys } from '#/data/source'
import { SourceContext } from '#/data/source-context'
import { SLUG_RE } from '#/lib/id'
import { accessFn } from '#/server/session'

export const Route = createFileRoute('/s/$slug')({
  // Loader (access check + data prefetch) runs on the server; components render on the client,
  // where TanStack DB collections live. Prefetched queries are dehydrated into the client QueryClient.
  ssr: 'data-only',
  loader: async ({ params: { slug }, context: { queryClient } }) => {
    if (!SLUG_RE.test(slug)) throw notFound()
    const { access } = await accessFn({ data: { slug } })
    if (access) {
      const names = Object.keys(queryKeys) as (keyof typeof queryKeys)[]
      await Promise.all(
        names.map((n) =>
          queryClient.ensureQueryData({ queryKey: queryKeys[n](slug), queryFn: () => listFns[n]({ data: { slug } }) as Promise<unknown[]> }),
        ),
      )
    }
    return { access }
  },
  component: SessionLayout,
})

function SessionLayout() {
  const { slug } = Route.useParams()
  const { access } = Route.useLoaderData()
  const { queryClient } = Route.useRouteContext()

  useEffect(() => {
    if (access) rememberSession(slug)
  }, [access, slug])

  if (!access) return <PinGate slug={slug} />

  return (
    <SourceContext.Provider value={getServerSource(queryClient, slug)}>
      <Shell>
        <Outlet />
      </Shell>
    </SourceContext.Provider>
  )
}
````

`src/routes/s.$slug.index.tsx`

````tsx
import { createFileRoute } from '@tanstack/react-router'
import { PagesView } from '#/components/PagesView'

export const Route = createFileRoute('/s/$slug/')({ component: PagesView })
````

`src/routes/s.$slug.p.$pageId.tsx`

````tsx
import { createFileRoute } from '@tanstack/react-router'
import { ChecklistView } from '#/components/ChecklistView'

export const Route = createFileRoute('/s/$slug/p/$pageId')({ component: Page })

function Page() {
  const { pageId } = Route.useParams()
  return <ChecklistView pageId={pageId} />
}
````

- [ ] **Step 5: Gerar rotas, typecheck, build**

```bash
npm run generate-routes && npm run typecheck && npm run build
```

Expected: sem erros.

- [ ] **Step 6: Smoke E2E** — `PORT=3999 npm run start` em background; usar o Playwright MCP em `http://localhost:3999`. Slug de teste: `smoketest01`, PIN `1234`. Cada item precisa passar:

  1. `/` → criar sessão `smoketest01`/`1234`/`1234`: dica muda para "Disponível ✓", redireciona para `/s/smoketest01`.
  2. Criar página "Mercado" → navega para `/s/smoketest01/p/<id>`; header mostra `0/0` e barra vazia (Review Focus 4).
  3. Criar seção "Hortifruti", tarefas "Banana" e "Tomate"; marcar "Banana" → contador `1/2` instantâneo.
  4. Menu ⋯ de "Tomate" → "＋ Badge" → "urgente" Enter → badge aparece com espaço após o texto. Menu ⋯ de "Banana" → "↓ Descer" → ordem troca.
  5. Recarregar a página → estado idêntico (persistência + prefetch SSR), console sem erros.
  6. Marcar "Tomate", aguardar 16 s na aba (≥ 1 polling) → continua marcado (Review Focus 1).
  7. ⚙ → tema "Rosa" + modo "Escuro" → recarregar → página já vem rosa/escura; `document.documentElement.dataset.theme === 'rosa'`.
  8. `page.context().clearCookies()` e recarregar → tela de PIN; tema no `<html>` é `roxo` (não vaza). Digitar 4 PINs errados → "PIN incorreto."; 5º → "Muitas tentativas…" (Review Focus 3). Destravar via SQL: `update sessions set locked_until = null, failed_attempts = 0 where slug = 'smoketest01'`. PIN `1234` → entra.
  9. ⚙ → "Deletar sessão" → digitar `smoketest01` + `1234` → volta para `/`; `localStorage['checklist-recent']` não contém o slug. Guardar o cookie antes de deletar; recriar `smoketest01` com PIN `9999` em **outra** aba sem cookie; restaurar o cookie antigo e abrir `/s/smoketest01` → deve pedir PIN (Review Focus 2). Deletar de novo ao final.
  10. `/local` → criar página, seção, tarefa, marcar → recarregar → mantém estado e `1/1`.
  11. Conferir no banco: `select count(*) from sessions` = 0 ao final.
  12. Voz (manual, Review Focus 5): no Chrome, 🎤 aparece no input de nova tarefa; no Firefox não aparece. Negar permissão de microfone → botão para de pulsar, nada quebra.

  Parar o servidor pelo PID (`ss -ltnp | grep 3999`), não com `pkill -f` (pode matar o próprio shell). Remover `.playwright-mcp/` se o MCP criar arquivos no repo.

- [ ] **Step 7: Commit** — invocar a skill `auto-commit`.

---

### Task 6: Imagem Docker

**Files:** nenhum novo (usa `Dockerfile`/`.dockerignore` da Task 1).

- [ ] **Step 1: Build e run**

```bash
docker build -t checklist .
docker run -d --rm --name checklist-smoke -p 3998:3000 --env-file .env checklist
sleep 2 && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3998/
docker image ls checklist --format '{{.Size}}'
docker stop checklist-smoke
```

Expected: `200`; imagem ~ 200 MB ou menos (node:24-alpine + `.output`).

- [ ] **Step 2: Deploy (informativo, não executar sem pedido do usuário)**: na VPS, `docker build -t checklist .` e `docker run -d --restart unless-stopped -p 3000:3000 --env-file .env checklist` atrás do proxy HTTPS existente (cookie `Secure` exige HTTPS em produção).

- [ ] **Step 3: Commit** — invocar a skill `auto-commit` (se houver mudanças).

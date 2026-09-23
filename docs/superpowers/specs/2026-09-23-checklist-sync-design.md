# Checklist sincronizado — Design

Data: 2026-09-23

## Objetivo

App de checklist para usar no celular e no PC com dados sincronizados, sem conta.
Visual baseado no artefato "Checklist Gestão de Projetos" (tokens na seção Temas).
Usuário cria páginas (título + subtítulo), seções (título, nota opcional, destaque) e
tasks (texto, feito/não feito, badges coloridos). Barra de progresso no topo da página.

Fora de escopo: testes (nenhum), troca de PIN, troca de slug, drag-and-drop, colaboração
em tempo real, badges reutilizáveis entre tasks.

## Stack

- TanStack Start (preset Node), React, TanStack Router, TanStack Query, TanStack DB
  (`@tanstack/react-db`, `@tanstack/query-db-collection`).
- Tailwind CSS v4 via `@tailwindcss/vite`.
- Dependências fora do ecossistema TanStack: `postgres` (driver, SQL puro, sem ORM) e
  `nanoid`. Nada além disso.
- Gerenciador de pacotes: npm.
- Deploy: `Dockerfile` multi-stage (build em `node:24-alpine` → runtime `node:24-alpine`
  contendo só `.output`). Postgres externo, banco `checklist`.

## Configuração (`.env`, fora do git)

```
DATABASE_URL=postgres://.../checklist
COOKIE_SECRET=<32+ bytes aleatórios>
```

`.env.example` versionado com os nomes, sem valores. Credenciais nunca em código, spec
ou commit.

## Modelo de dados

IDs: `customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 16)`
do `nanoid`, gerados no cliente (insert otimista já nasce com o id final).

```sql
sessions (
  slug            text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]{3,40}$'),
  pin_hash        text NOT NULL,          -- scrypt, formato "salt:hash" hex
  theme           text NOT NULL DEFAULT 'roxo',
  mode            text NOT NULL DEFAULT 'system',  -- light | dark | system
  failed_attempts int  NOT NULL DEFAULT 0,
  lock_level      int  NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
)
pages (
  id text PRIMARY KEY,
  session_slug text NOT NULL REFERENCES sessions ON DELETE CASCADE,
  title text NOT NULL, subtitle text NOT NULL DEFAULT '',
  position int NOT NULL
)
sections (
  id text PRIMARY KEY,
  page_id text NOT NULL REFERENCES pages ON DELETE CASCADE,
  title text NOT NULL, note text NOT NULL DEFAULT '',
  highlight boolean NOT NULL DEFAULT false,
  position int NOT NULL
)
tasks (
  id text PRIMARY KEY,
  section_id text NOT NULL REFERENCES sections ON DELETE CASCADE,
  text text NOT NULL, done boolean NOT NULL DEFAULT false,
  badges jsonb NOT NULL DEFAULT '[]',   -- [{ "text": string, "color": "#rrggbb" }]
  position int NOT NULL
)
```

- Índices em `pages(session_slug)`, `sections(page_id)`, `tasks(section_id)`.
- Migração: `schema.sql` com `CREATE TABLE/INDEX IF NOT EXISTS`, executado de forma lazy na
  primeira query do processo (retentado na próxima requisição se falhar).
- `position`: inteiro; novo item = `max + 1`; reordenar ↑/↓ troca a posição com o vizinho.
- Slug imutável: nenhuma rota/função atualiza `sessions.slug`.

## Rotas

| Rota | Conteúdo |
|------|----------|
| `/` | Cartões "Usar sem salvar", "Criar sessão", "Entrar" + sessões recentes do aparelho (localStorage) |
| `/local` | Modo anônimo — lista de páginas (`ssr: false`) |
| `/local/p/$pageId` | Modo anônimo — checklist |
| `/s/$slug` | Tela de PIN se sem cookie; senão lista de páginas + configurações |
| `/s/$slug/p/$pageId` | Checklist — link compartilhável |

## Fonte de dados (TanStack DB)

Interface única consumida pela UI via contexto React:

```ts
type Source = { pages, sections, tasks, settings } // 4 collections
createServerSource(slug) // queryCollectionOptions → server functions
createLocalSource()      // localStorageCollectionOptions
```

- Modo slug: cada collection carrega todos os registros da sessão (volume pequeno, sem
  paginação). `onInsert/onUpdate/onDelete` enviam `transaction.mutations` em lote para
  server functions. `onUpdate` envia só `changes` (last-write-wins por campo).
- Modo anônimo: `localStorageCollectionOptions` com chaves `checklist-local-*`; sync entre
  abas grátis via `storage` event. `settings` local guarda tema/modo.
- QueryClient: `refetchInterval: 15_000`, `refetchOnWindowFocus: true`.
- Reordenar: `collection.update([a, b], …)` em lote troca as duas `position` → um único
  `onUpdate` → uma server function que roda ambas numa transação SQL.
- Progresso: tasks vêm do servidor com `pageId` (derivado via join, não é coluna); `useLiveQuery`
  filtra tasks por `pageId`; `done/total`.
  Lista de páginas mostra mini-barra por página com a mesma query agregada.
- SSR (modo slug): loader da rota busca dados no servidor e pré-popula as collections; tema
  e modo aplicados no `<html>` no SSR (sem flash).

## Optimistic UI

Toda ação aplica instantaneamente: marcar, criar, editar, deletar, reordenar, badges, tema,
modo. Falha → rollback automático do TanStack DB + toast próprio (sem lib) "Não salvou —
tentar de novo" que reexecuta a mutação.

## Sessão, PIN e segurança

- **Criar:** slug (`^[a-z0-9]{3,40}$`) + PIN de exatamente 4 dígitos, digitado duas vezes.
  Disponibilidade checada com debounce de 400 ms enquanto digita (informativo);
  `INSERT ... ON CONFLICT DO NOTHING` é a checagem real → "slug já existe".
- **Hash:** `scrypt` do `node:crypto` com salt aleatório de 16 bytes; comparação com
  `timingSafeEqual`.
- **Entrar:** PIN correto grava cookie `ck_<slug>` = `slug.assinatura`, onde assinatura =
  HMAC-SHA256(`COOKIE_SECRET`, `slug:pin_hash`); httpOnly, `SameSite=Lax`, `Secure` em
  produção, 1 ano. Como o `pin_hash` tem salt novo a cada criação, deletar e recriar o mesmo
  slug invalida todos os cookies antigos.
- **Força bruta:** cada erro incrementa `failed_attempts`; a cada 5 erros,
  `locked_until = now() + 15min * 2^lock_level` (teto 24 h) e `lock_level++`,
  `failed_attempts = 0`. Acerto zera `failed_attempts` e `lock_level`. Durante o bloqueio,
  resposta "bloqueado até HH:MM" sem checar PIN.
- **Anti-enumeração na tela de PIN:** slug inexistente responde igual a PIN errado.
  (A checagem de disponibilidade na criação revela existência por design — aceito.)
- **Autorização:** helper `requireAccess(slug)` chamado no início de toda server function de
  dados valida o cookie contra o `pin_hash` atual; inválido → erro `UNAUTHORIZED` → UI
  volta para a tela de PIN. Escritas sempre filtram por posse (`pages.session_slug = $slug`, via join para sections/tasks) — trocar id não
  alcança dados de outra sessão.
- **Validação no servidor (manual, sem Zod):** título/subtítulo/seção ≤ 200 chars, nota ≤
  500, task ≤ 1000, ≤ 10 badges por task, badge texto ≤ 30, cor `^#[0-9a-f]{6}$`,
  tema ∈ presets, modo ∈ {light, dark, system}, ids no alfabeto nanoid com 16 chars.
- **Deletar sessão:** em configurações; exige redigitar slug + PIN. Cascade apaga tudo;
  cookie limpo; slug removido dos recentes. Irreversível.

## Erros

| Caso | Comportamento |
|------|---------------|
| Rede / 5xx em mutação | Rollback + toast com "Tentar de novo" |
| 401 | Redireciona para tela de PIN do slug |
| Slug inexistente em `/s/$slug` | Tela de PIN (anti-enumeração); PIN sempre falha |
| `pageId` inexistente | Página "não encontrada" com link para a lista |
| Postgres fora do ar | Server function falha → rollback + toast; migração é retentada na próxima requisição |

## Interface

Base visual do artefato: coluna `max-width: 720px`, padding lateral 16px, header sticky
(título Manrope 800 1.5rem, subtítulo `--ink-soft` 0.9rem, barra 8px arredondada +
contador `done/total` tabular), cards de seção (`--surface`, borda `--line`, raio 16px,
número da seção em `--accent`), variante destaque (`--warn-soft`, número `--warn`),
checkbox customizado 19px com check em `--done`, task feita riscada em `--ink-soft`.
Fontes: Manrope 700/800 (títulos) e IBM Plex Sans 400/500/600 (texto) via Google Fonts.

- **Edição inline:** clicar em título/subtítulo/seção/nota/task vira `input`; Enter ou
  blur salva, Esc cancela.
- **Menu `⋯`** por task (↑, ↓, adicionar badge, deletar) e por seção (↑, ↓, destaque
  on/off, nota, deletar), usando popover API nativa.
- **Nova task:** input fixo no fim de cada seção; Enter cria e mantém foco.
- **Nova seção:** botão no fim da página. **Nova página:** na lista de páginas.
- **Badges:** popover com 8 cores de paleta + custom (`<input type="color">`) + texto.
  Clicar no badge edita/remove. Fundo do badge = `color-mix(in oklab, <cor> 16%,
  var(--surface))`, texto = `color-mix(in oklab, <cor> 80%, var(--ink))` — funciona em
  claro e escuro sem JS.
- **Voz:** botão 🎤 no input de nova task, renderizado só se `SpeechRecognition ||
  webkitSpeechRecognition` existir. `lang = 'pt-BR'`, `interimResults = true`; texto
  aparece no input em tempo real; tocar de novo para parar; texto fica para revisão antes
  do Enter.
- **Configurações da sessão** (engrenagem em `/s/$slug`): tema, modo, copiar link,
  deletar sessão. No modo anônimo: tema e modo.
- **Mobile:** alvos de toque ≥ 40px, `viewport-fit=cover`, safe-area insets.

## Temas

Presets: `roxo` (padrão), `rosa`, `verde`, `azul`, `ambar`, `grafite`. Cada um define as
variables `--ink --ink-soft --line --surface --ground --accent --accent-soft --done
--done-soft --warn --warn-soft` em versão clara e escura, via `[data-theme]` e
`[data-mode]` no `<html>` (`system` usa `prefers-color-scheme`). Tailwind v4 consome as
variables com `@theme inline`.

Tokens do preset `roxo` (idênticos ao artefato):

| Token | Claro | Escuro |
|-------|-------|--------|
| `--ink` | `#1c1a22` | `#f1eef7` |
| `--ink-soft` | `#5b5766` | `#b8b2c8` |
| `--line` | `#e4e0ec` | `#332f40` |
| `--surface` | `#ffffff` | `#211f2b` |
| `--ground` | `#faf9fc` | `#17151e` |
| `--accent` | `#6d28d9` | `#a78bfa` |
| `--accent-soft` | `#efe7fc` | `#2c2540` |
| `--done` | `#16a34a` | `#4ade80` |
| `--done-soft` | `#e9f8ee` | `#1c3327` |
| `--warn` | `#b45309` | `#fbbf24` |
| `--warn-soft` | `#fdf1de` | `#3a2c11` |

Demais presets: mesma estrutura, trocando `--accent`, `--accent-soft`, e tons de
`--ground/--surface/--line` puxados para o matiz do preset; `--done` e `--warn` iguais em
todos. `grafite` usa accent neutro (`#3f3f46` / `#d4d4d8`).

Paleta de badges (8): vermelho `#dc2626`, laranja `#ea580c`, âmbar `#d97706`, verde
`#16a34a`, azul `#2563eb`, roxo `#7c3aed`, rosa `#db2777`, cinza `#6b7280`.

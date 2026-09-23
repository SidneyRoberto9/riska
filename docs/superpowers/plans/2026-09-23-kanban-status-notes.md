# Kanban, Status por Página, Notas e Drag-and-Drop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar os badges livres por status por página (A Fazer / Em Andamento / Concluído + customizáveis) sincronizados com o checkbox, adicionar notas com ditado por voz, uma visão Quadro (Kanban) em tela cheia com modal de detalhes, e drag-and-drop otimista em tarefas, seções, colunas e páginas.

**Architecture:** Nova coleção TanStack DB `statuses` (tabela Postgres + localStorage) ao lado de pages/sections/tasks. Tarefa ganha `statusId` (null = primeiro status da página), `note`, `createdAt`, `boardPosition`; `done` continua e é sempre escrito junto com `statusId`. Regras puras (fallback de status, checkbox↔status, renumeração) ficam em `src/lib/*.ts` testadas com `node --test`. Um wrapper único sobre `@dnd-kit` (`src/components/dnd.tsx`) serve Lista, Quadro e Páginas: estado local só durante o arrasto, commit como **uma** mutation otimista.

**Tech Stack:** TanStack Start/Router/DB (0.9) · React 19 · Tailwind 4 · `postgres` 3.4 · `@dnd-kit/core` 6.3 + `@dnd-kit/sortable` 10 + `@dnd-kit/utilities` 3.2 · Web Speech API · `<dialog>` nativo · Node 24 (`node --test` com type stripping).

**Spec:** `docs/superpowers/specs/2026-09-23-kanban-status-notes-design.md`

## Global Constraints

- **npm** apenas (`npm install`, `npm run`, `npx`). Nunca pnpm/yarn/bun.
- Novas dependências: **somente** `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2`.
- Testes: só `node:test` + `node:assert/strict` para funções puras em `src/lib/` (`npm test`). Nada de framework de teste. Arquivos em `src/lib/*.ts` testados **não podem importar valores via `#/`** (Node não resolve o alias) — só `import type` ou imports relativos com `.ts`.
- Commits: **nunca** `git commit` direto — invocar a skill `auto-commit` no fim de cada task.
- UI em pt-BR. Alias `#/*` → `src/*`. Seguir o estilo existente: componentes função nomeados, Tailwind inline, comentários curtos só onde explicam o porquê, ternários permitidos.
- Verificação mínima de toda task: `npm run typecheck` e `npm run build` sem erros; `npm test` verde a partir da Task 1.
- `DATABASE_URL` do `.env` aponta para um Postgres remoto (`/checklist`, hoje **vazio**). O dev server roda a migração nele no primeiro request. Não imprimir credenciais.
- Limites: `LIMITS.statusName = 30`, `LIMITS.taskNote = 2000`, `LIMITS.note = 500` (seção), `LIMITS.task = 1000`.
- Status padrão (nome · cor · done): `A Fazer · #6b7280 · false`, `Em Andamento · #2563eb · false`, `Concluído · #16a34a · true`.
- Sensores DnD: mouse `distance: 5`; touch `delay: 180, tolerance: 6` (ignorado em `.drag-handle`); teclado inicia só com **Espaço**.
- Search params das rotas de página: `view?: 'quadro'`, `task?: string` (id). Modal de tarefa **só** quando `view === 'quadro'`.
- Dev server: `npm run dev` (porta 3000). Para E2E usar o Playwright MCP.

## Review Focus

1. **Soltar no mesmo lugar / clique pós-arrasto** — soltar um item onde ele estava não grava nada nem "pisca", e o clique que encerra um arrasto de card não abre o modal → E2E na Task 4 passo 7.
2. **Coluna apagada (localmente ou em outro aparelho)** — tarefas nunca somem: caem na coluna vizinha (delete local) ou na primeira coluna (`status_id` NULL); a última coluna não pode ser apagada → testes `neighbour`/`statusOf` na Task 1 + E2E Task 4 passo 7.
3. **Dados legados do modo local** (páginas sem status, tarefas com `badges` e sem `boardPosition`) — abrir a página atualiza sem erro e o quadro ordena corretamente → Task 1 passo 12.
4. **Microfone durante edição inline** — clicar no botão de ditado não tira o foco nem fecha/salva a edição → Task 2 passo 8.
5. **Migração idempotente** — reiniciar o servidor não duplica status nem mexe em tarefas já migradas → Task 1 passo 11.

---

## File Structure

```
src/lib/types.ts            MOD  Status, Task novos campos, DEFAULT_STATUSES, STATUS_COLORS, LIMITS
src/lib/order.ts            NEW  nextPosition, renumber, shift (puras)
src/lib/order.test.ts       NEW
src/lib/status.ts           NEW  statusOf, firstDone, firstOpen, statusChanges, doneChanges, chipHidden, neighbour (puras)
src/lib/status.test.ts      NEW
src/server/schema.sql       MOD  tabela statuses + colunas de tasks + migração idempotente + drop badges
src/server/validate.ts      MOD  nullable, isoDate, statusFields, taskFields, taskUpdateFields
src/server/data.ts          MOD  CRUD statuses; tasks com status/note/createdAt/boardPosition/sectionId
src/data/source.ts          MOD  coleção statuses (server + local)
src/data/actions.ts         MOD  reorderTx, status actions, setTaskDone/Status, reorderTasks/Board, upgradeLocalPage
src/data/page-search.ts     NEW  validatePageSearch, useSetPageSearch
src/components/Badge.tsx    DEL  (substituído por Status.tsx)
src/components/Status.tsx   NEW  StatusChip, StatusEditor, StatusOptions, StatusPicker
src/components/InlineEdit.tsx MOD prop voice, viewClassName
src/components/VoiceButton.tsx MOD prop label, não rouba foco
src/components/dnd.tsx      NEW  SortableBoard, SortableColumns, ColumnItems, hooks, DragPreview, dragFrom, useClickGuard
src/components/TaskRow.tsx  MOD  chip de status, nota, handle DnD
src/components/SectionCard.tsx MOD handle DnD, ColumnItems
src/components/PagesView.tsx MOD PageCard sortable
src/components/ChecklistView.tsx MOD statuses, DnD da lista, toggle, Quadro, modal
src/components/ViewToggle.tsx NEW
src/components/Board.tsx    NEW  Board, Column, Card, CardFace, AddCard, NewColumn
src/components/TaskDialog.tsx NEW
src/components/Shell.tsx    MOD  largura total com view=quadro
src/routes/s.$slug.p.$pageId.tsx, src/routes/local.p.$pageId.tsx MOD validateSearch
src/styles.css              MOD  drag-ghost, drag-lift, drag-handle, task-dialog
package.json                MOD  script test, deps dnd-kit
```

---

### Task 1: Camada de dados — status, notas, datas, posições

Entrega: modelo novo ponta a ponta (Postgres, validação, coleções, ações) com a UI atual funcionando (sem badges; checkbox já sincroniza status). Testes das regras puras.

**Files:**
- Create: `src/lib/order.ts`, `src/lib/order.test.ts`, `src/lib/status.ts`, `src/lib/status.test.ts`
- Modify: `src/lib/types.ts`, `src/server/schema.sql`, `src/server/validate.ts`, `src/server/data.ts`, `src/data/source.ts`, `src/data/actions.ts`, `src/components/TaskRow.tsx`, `src/components/ChecklistView.tsx`, `package.json`
- Delete: `src/components/Badge.tsx`

**Interfaces:**
- Produces (types): `Status = { id; pageId; name; color; done: boolean; position }`; `Task` agora `{ id; sectionId; pageId; text; done; statusId: string | null; note: string; createdAt: string | null; position; boardPosition }`; `DEFAULT_STATUSES`, `STATUS_COLORS`, `LIMITS.statusName`, `LIMITS.taskNote`.
- Produces (lib): `nextPosition(items: {position:number}[]): number`, `renumber(ids: string[], current: Map<string, number>): Map<string, number>`, `shift(ids: string[], id: string, dir: -1|1): string[]`, `statusOf(task, statuses): Status|undefined`, `firstDone`, `firstOpen`, `statusChanges(s): {statusId, done}`, `doneChanges(task, statuses, done)`, `chipHidden(task, statuses): boolean`, `neighbour(statuses, id): Status|undefined`.
- Produces (source): `Source.statuses: Collection<Status, string>`.
- Produces (actions via `useActions()`): `addPage`, `updatePage`, `deletePage`, `movePage(sorted, id, dir)`, `reorderPages(ids)`, `addSection`, `updateSection`, `deleteSection`, `moveSection(sorted, id, dir)`, `reorderSections(ids)`, `addStatus(pageId, draft): string`, `updateStatus(status, changes)`, `deleteStatus(status)`, `moveStatus(sorted, id, dir)`, `reorderStatuses(ids)`, `addTask(section, text, status?)`, `updateTask(id, {text?, note?})`, `setTaskDone(task, done)`, `setTaskStatus(task, status)`, `deleteTask(id)`, `moveTask(sorted, id, dir)`, `reorderTasks(ids, moved?: {id, sectionId})`, `reorderBoard(ids, moved?: {id, status})`, `upgradeLocalPage(pageId)`, `setSettings`.

- [ ] **Step 1: Script de teste**

Em `package.json`, dentro de `"scripts"`, adicionar depois de `"typecheck"`:

```json
    "test": "node --test src/lib/*.test.ts"
```

- [ ] **Step 2: Escrever os testes (falham)**

`src/lib/order.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextPosition, renumber, shift } from './order.ts'

test('renumber returns only the rows whose position changes', () => {
  const current = new Map([['a', 1], ['b', 2], ['c', 3]])
  assert.deepEqual([...renumber(['a', 'c', 'b'], current)], [['c', 2], ['b', 3]])
  assert.equal(renumber(['a', 'b', 'c'], current).size, 0)
})

test('renumber fills gaps and unknown ids', () => {
  assert.deepEqual([...renumber(['x', 'a'], new Map([['a', 5]]))], [['x', 1], ['a', 2]])
})

test('shift swaps with the neighbour and clamps at the edges', () => {
  assert.deepEqual(shift(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c'])
  assert.deepEqual(shift(['a', 'b', 'c'], 'b', 1), ['a', 'c', 'b'])
  assert.deepEqual(shift(['a', 'b'], 'a', -1), ['a', 'b'])
  assert.deepEqual(shift(['a', 'b'], 'b', 1), ['a', 'b'])
  assert.deepEqual(shift(['a'], 'zz', 1), ['a'])
})

test('nextPosition is max + 1', () => {
  assert.equal(nextPosition([]), 1)
  assert.equal(nextPosition([{ position: 4 }, { position: 2 }]), 5)
})
```

`src/lib/status.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chipHidden, doneChanges, firstDone, firstOpen, neighbour, statusChanges, statusOf } from './status.ts'
import type { Status } from './types'

const S = (id: string, done = false): Status => ({ id, pageId: 'p', name: id, color: '#000000', done, position: 0 })
const todo = S('todo')
const doing = S('doing')
const done = S('done', true)
const shipped = S('shipped', true)
const all = [todo, doing, done]

test('statusOf falls back to the first status for null or unknown ids', () => {
  assert.equal(statusOf({ statusId: null }, all), todo)
  assert.equal(statusOf({ statusId: 'gone' }, all), todo)
  assert.equal(statusOf({ statusId: 'doing' }, all), doing)
  assert.equal(statusOf({ statusId: null }, []), undefined)
})

test('firstDone / firstOpen', () => {
  assert.equal(firstDone([todo, shipped, done]), shipped)
  assert.equal(firstOpen([done, doing]), doing)
  assert.equal(firstDone([todo]), undefined)
})

test('statusChanges copies the column done flag', () => {
  assert.deepEqual(statusChanges(done), { statusId: 'done', done: true })
  assert.deepEqual(statusChanges(doing), { statusId: 'doing', done: false })
})

test('checking moves to the first done status', () => {
  assert.deepEqual(doneChanges({ statusId: 'doing', done: false }, [todo, doing, done, shipped], true), { done: true, statusId: 'done' })
})

test('checking without any done status only sets done', () => {
  assert.deepEqual(doneChanges({ statusId: 'doing', done: false }, [todo, doing], true), { done: true })
})

test('unchecking from a done column moves to the first open status', () => {
  assert.deepEqual(doneChanges({ statusId: 'shipped', done: true }, [todo, doing, done, shipped], false), { done: false, statusId: 'todo' })
})

test('unchecking from an open column keeps the column', () => {
  assert.deepEqual(doneChanges({ statusId: 'doing', done: true }, all, false), { done: false })
})

test('chipHidden hides the default column and the default done column only', () => {
  const list = [todo, doing, done, shipped]
  assert.equal(chipHidden({ statusId: null, done: false }, list), true)
  assert.equal(chipHidden({ statusId: 'doing', done: false }, list), false)
  assert.equal(chipHidden({ statusId: 'done', done: true }, list), true)
  assert.equal(chipHidden({ statusId: 'shipped', done: true }, list), false)
  assert.equal(chipHidden({ statusId: null, done: false }, []), true)
})

test('neighbour prefers the previous column, then the next, none for a single column', () => {
  assert.equal(neighbour(all, 'doing'), todo)
  assert.equal(neighbour(all, 'todo'), doing)
  assert.equal(neighbour([todo], 'todo'), undefined)
  assert.equal(neighbour(all, 'gone'), undefined)
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../src/lib/order.ts'`.

- [ ] **Step 4: Implementar `src/lib/order.ts`**

```ts
type Positioned = { position: number }

export const nextPosition = (items: Positioned[]) => items.reduce((max, x) => Math.max(max, x.position), 0) + 1

// 1-based positions for `ids` in order, only for rows whose stored position actually changes
export function renumber(ids: string[], current: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  ids.forEach((id, i) => {
    if (current.get(id) !== i + 1) out.set(id, i + 1)
  })
  return out
}

// `ids` with `id` swapped with its neighbour in `dir`; unchanged when that would leave the list
export function shift(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= ids.length) return ids
  const next = [...ids]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
```

- [ ] **Step 5: Implementar `src/lib/status.ts`**

```ts
import type { Status, Task } from './types'

// Every function takes ONE page's statuses sorted by position.
type TaskState = Pick<Task, 'statusId' | 'done'>

// A null (or deleted) status means the page's first column, so tasks never disappear from the board
export const statusOf = (task: Pick<Task, 'statusId'>, statuses: Status[]): Status | undefined =>
  statuses.find((s) => s.id === task.statusId) ?? statuses[0]

export const firstDone = (statuses: Status[]) => statuses.find((s) => s.done)
export const firstOpen = (statuses: Status[]) => statuses.find((s) => !s.done)

export const statusChanges = (s: Status): TaskState => ({ statusId: s.id, done: s.done })

// Checkbox → column: checking goes to the first "done" column; unchecking leaves a done column for the first open one
export function doneChanges(task: TaskState, statuses: Status[], done: boolean): Partial<TaskState> {
  const target = done ? firstDone(statuses) : statusOf(task, statuses)?.done ? firstOpen(statuses) : undefined
  return target ? { done, statusId: target.id } : { done }
}

// The chip is noise for the default column and for tasks checked into the default done column (the strike-through says it)
export function chipHidden(task: TaskState, statuses: Status[]) {
  const s = statusOf(task, statuses)
  return !s || s === statuses[0] || (task.done && s === firstDone(statuses))
}

// Where a deleted column's tasks go: the previous column, or the next one when deleting the first
export function neighbour(statuses: Status[], id: string): Status | undefined {
  const i = statuses.findIndex((s) => s.id === id)
  if (i < 0) return undefined
  return statuses[i - 1] ?? statuses[i + 1]
}
```

- [ ] **Step 6: Tipos (`src/lib/types.ts`)**

Substituir da linha `export const BADGE_COLORS` até o fim do arquivo por:

```ts
export const STATUS_COLORS = ['#dc2626', '#ea580c', '#d97706', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#6b7280']

export const LIMITS = { title: 200, note: 500, task: 1000, taskNote: 2000, statusName: 30 }

export type Page = { id: string; title: string; subtitle: string; position: number }
export type Section = { id: string; pageId: string; title: string; note: string; highlight: boolean; position: number }
export type Status = { id: string; pageId: string; name: string; color: string; done: boolean; position: number }
// pageId is derived server-side from the section (not a column); kept on the client for cheap per-page filtering.
// statusId null (or pointing at a deleted status) means the page's first status. `done` is always written with statusId.
// position orders the task inside its section (Lista); boardPosition orders it inside its column (Quadro).
export type Task = {
  id: string
  sectionId: string
  pageId: string
  text: string
  done: boolean
  statusId: string | null
  note: string
  createdAt: string | null
  position: number
  boardPosition: number
}
export type Settings = { id: 'settings'; theme: ThemeId; mode: Mode }

export const DEFAULT_SETTINGS: Settings = { id: 'settings', theme: 'roxo', mode: 'system' }

export const DEFAULT_STATUSES: Pick<Status, 'name' | 'color' | 'done'>[] = [
  { name: 'A Fazer', color: '#6b7280', done: false },
  { name: 'Em Andamento', color: '#2563eb', done: false },
  { name: 'Concluído', color: '#16a34a', done: true },
]
```

- [ ] **Step 7: Rodar os testes**

Run: `npm test`
Expected: PASS (todos os `test(...)` de order e status).

- [ ] **Step 8: Schema e migração (`src/server/schema.sql`)**

Acrescentar ao **fim** do arquivo (o `CREATE TABLE statuses` precisa vir antes do `ALTER` que o referencia):

```sql
CREATE TABLE IF NOT EXISTS statuses (
  id       text PRIMARY KEY,
  page_id  text NOT NULL REFERENCES pages ON DELETE CASCADE,
  name     text NOT NULL,
  color    text NOT NULL,
  done     boolean NOT NULL DEFAULT false,
  position int NOT NULL
);
CREATE INDEX IF NOT EXISTS statuses_page_idx ON statuses (page_id);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_id      text REFERENCES statuses ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS note           text NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at     timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_position int NOT NULL DEFAULT 0;

-- Idempotent data migration (runs on every boot): default statuses for pages without any,
-- done tasks into the first done column, board order seeded from list order, free badges dropped.
INSERT INTO statuses (id, page_id, name, color, done, position)
SELECT substr(md5(random()::text || p.id || d.position), 1, 16), p.id, d.name, d.color, d.done, d.position
FROM pages p
CROSS JOIN (VALUES ('A Fazer', '#6b7280', false, 1), ('Em Andamento', '#2563eb', false, 2), ('Concluído', '#16a34a', true, 3))
  AS d(name, color, done, position)
WHERE NOT EXISTS (SELECT 1 FROM statuses s WHERE s.page_id = p.id);

UPDATE tasks t SET status_id = (
  SELECT st.id FROM statuses st JOIN sections sc ON sc.page_id = st.page_id
  WHERE sc.id = t.section_id AND st.done ORDER BY st.position LIMIT 1)
WHERE t.done AND t.status_id IS NULL;

UPDATE tasks SET board_position = position WHERE board_position = 0;

ALTER TABLE tasks DROP COLUMN IF EXISTS badges;
```

- [ ] **Step 9: Validação (`src/server/validate.ts`)**

1. Import: `import { LIMITS, MODES, THEMES } from '#/lib/types'` (sem `type Badge`).
2. Depois de `export const arr = ...`, adicionar:

```ts
export const nullable = <T>(f: Check<T>): Check<T | null> => (v) => (v === null ? null : f(v))
export const isoDate: Check<string> = (v) =>
  typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : invalid()
```

3. Remover o bloco `export const badges ...` inteiro.
4. Substituir a linha `export const taskFields = ...` por:

```ts
export const statusFields = { name: str(LIMITS.statusName), color, done: bool, position: int }
export const taskFields = {
  text: str(LIMITS.task),
  done: bool,
  statusId: nullable(id),
  note: str(LIMITS.taskNote),
  createdAt: nullable(isoDate),
  position: int,
  boardPosition: int,
}
// Moving a task between sections (list drag-and-drop) is update-only
export const taskUpdateFields = { ...taskFields, sectionId: id }
```

- [ ] **Step 10: Server functions (`src/server/data.ts`)**

1. Imports:

```ts
import type { Page, Section, Status, Task } from '#/lib/types'
import { arr, id, pageFields, partial, sectionFields, shape, slug, statusFields, taskFields, taskUpdateFields } from './validate'
```

2. Trocar o `select` de `listTasksFn` por:

```ts
    return [...(await sql<Task[]>`
      select t.id, t.section_id, s.page_id, t.text, t.done, t.status_id, t.note,
             to_json(t.created_at) #>> '{}' as created_at, t.position, t.board_position
      from tasks t join sections s on s.id = t.section_id join pages p on p.id = s.page_id
      where p.session_slug = ${s}`)]
```

(`to_json(...) #>> '{}'` devolve ISO 8601 como string — o serializer do Start transformaria `Date` em objeto.)

3. Depois do bloco `// ---- sections`, adicionar:

```ts
// ---- statuses ----------------------------------------------------------

export const listStatusesFn = createServerFn()
  .validator(bySlug)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    return [...(await sql<Status[]>`
      select st.id, st.page_id, st.name, st.color, st.done, st.position
      from statuses st join pages p on p.id = st.page_id
      where p.session_slug = ${s}`)]
  })

export const insertStatusesFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug, items: arr(shape({ id, pageId: id, ...statusFields })) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const x of data.items) {
        const [ok] = await tx`select 1 from pages where id = ${x.pageId} and session_slug = ${s}`
        if (!ok) throw new Error('NOT_FOUND')
        await tx`insert into statuses ${tx(x)}`
      }
    })
  })

export const updateStatusesFn = createServerFn({ method: 'POST' })
  .validator(updates(statusFields))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const { id, changes } of data.items) {
        await tx`update statuses set ${tx(changes as Record<string, any>)}
          where id = ${id} and page_id in (select id from pages where session_slug = ${s})`
      }
    })
  })

export const deleteStatusesFn = createServerFn({ method: 'POST' })
  .validator(removals)
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql`delete from statuses where id = any(${data.ids}) and page_id in (select id from pages where session_slug = ${s})`
  })
```

4. No bloco `// ---- tasks`: apagar `withJson` e o comentário acima dele; substituir `insertTasksFn` e `updateTasksFn` por:

```ts
export const insertTasksFn = createServerFn({ method: 'POST' })
  .validator(shape({ slug, items: arr(shape({ id, sectionId: id, ...taskFields })) }))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const x of data.items) {
        // Section in this session; a status, when set, must belong to that section's page
        const [ok] = await tx`
          select 1 from sections sc join pages p on p.id = sc.page_id
          where sc.id = ${x.sectionId} and p.session_slug = ${s}
            and (${x.statusId}::text is null
                 or exists (select 1 from statuses st where st.id = ${x.statusId} and st.page_id = sc.page_id))`
        if (!ok) throw new Error('NOT_FOUND')
        await tx`insert into tasks ${tx(x)}`
      }
    })
  })

export const updateTasksFn = createServerFn({ method: 'POST' })
  .validator(updates(taskUpdateFields))
  .handler(async ({ data }) => {
    const s = await requireAccess(data.slug)
    const sql = await db()
    await sql.begin(async (tx) => {
      for (const { id, changes } of data.items) {
        const sectionId = changes.sectionId ?? null
        const statusId = changes.statusId ?? null
        // The (possibly new) section must be in this session and a new status must be on that section's page;
        // otherwise nothing is written (same as updating a row another device already deleted)
        await tx`update tasks t set ${tx(changes as Record<string, any>)}
          from sections sc join pages p on p.id = sc.page_id
          where t.id = ${id} and sc.id = coalesce(${sectionId}::text, t.section_id) and p.session_slug = ${s}
            and (${statusId}::text is null
                 or exists (select 1 from statuses st where st.id = ${statusId} and st.page_id = sc.page_id))`
      }
    })
  })
```

- [ ] **Step 11: Coleções (`src/data/source.ts`)**

1. Import de tipos: `import type { Page, Section, Settings, Status, Task } from '#/lib/types'`.
2. Import das server fns: adicionar `deleteStatusesFn, insertStatusesFn, listStatusesFn, updateStatusesFn`.
3. `Source`: adicionar `statuses: Collection<Status, string>` depois de `sections`.
4. `queryKeys`: adicionar `statuses: (slug: string) => ['statuses', slug],` depois de `sections`.
5. `listFns`: `{ pages: listPagesFn, sections: listSectionsFn, statuses: listStatusesFn, tasks: listTasksFn, settings: getSettingsFn }`.
6. `getServerSource`, depois de `sections:`:

```ts
      statuses: serverCollection<Status>(qc, slug, 'statuses', { insert: insertStatusesFn, update: updateStatusesFn, remove: deleteStatusesFn }),
```

7. `getLocalSource`, depois de `sections:`: `statuses: localCollection<Status>('statuses'),`

O loader de `/s/$slug` itera `Object.keys(queryKeys)`, então o prefetch de statuses é automático.

- [ ] **Step 12: Ações (`src/data/actions.ts`) — substituir o arquivo inteiro**

```ts
import { useRouter } from '@tanstack/react-router'
import type { Collection, Transaction } from '@tanstack/react-db'
import { useToast } from '#/components/toast'
import { newId } from '#/lib/id'
import { nextPosition, renumber, shift } from '#/lib/order'
import { doneChanges, neighbour, statusChanges, statusOf } from '#/lib/status'
import type { Page, Section, Settings, Status, Task } from '#/lib/types'
import { DEFAULT_SETTINGS, DEFAULT_STATUSES } from '#/lib/types'
import { useSource } from './source-context'

type Row = { id: string }
type StatusDraft = Pick<Status, 'name' | 'color' | 'done'>

// Writes 1..n into `field` for `ids` (only rows that change) plus per-row extra changes:
// one optimistic transaction = one server call, so a drop never half-applies
function reorderTx<T extends Row>(c: Collection<T, string>, ids: string[], field: keyof T & string, extra: Record<string, Partial<T>> = {}) {
  const pos = renumber(ids, new Map(ids.map((id) => [id, Number(c.get(id)?.[field])])))
  const keys = [...new Set([...pos.keys(), ...Object.keys(extra)])].filter((id) => c.has(id))
  if (!keys.length) return null
  return c.update(keys, (drafts) => {
    drafts.forEach((d, i) => {
      const p = pos.get(keys[i])
      if (p !== undefined) Object.assign(d, { [field]: p })
      Object.assign(d, extra[keys[i]])
    })
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
      toast('Não salvou.', { label: 'Tentar de novo', onClick: () => run(mutate) })
    })
  }

  const { pages, sections, statuses, tasks, settings } = source
  const all = <T extends object>(c: Collection<T, string>) => [...c.values()]
  const pageStatuses = (pageId: string) =>
    all(statuses)
      .filter((s) => s.pageId === pageId)
      .sort((a, b) => a.position - b.position)
  const defaultStatuses = (pageId: string): Status[] =>
    DEFAULT_STATUSES.map((s, i) => ({ ...s, id: newId(), pageId, position: i + 1 }))
  // A task that changes column lands at the bottom of it
  const boardEnd = (pageId: string) =>
    nextPosition(all(tasks).filter((t) => t.pageId === pageId).map((t) => ({ position: t.boardPosition ?? 0 })))
  const setTaskState = (task: Task, changes: Partial<Task>) => {
    if (!tasks.has(task.id)) return
    const moved = changes.statusId !== undefined && changes.statusId !== task.statusId
    const extra = moved ? { boardPosition: boardEnd(task.pageId) } : {}
    run(() => tasks.update(task.id, (d) => void Object.assign(d, changes, extra)))
  }
  const tasksInColumn = (status: Status) => {
    const list = pageStatuses(status.pageId)
    return all(tasks).filter((t) => t.pageId === status.pageId && statusOf(t, list)?.id === status.id)
  }

  return {
    addPage(title: string) {
      const id = newId()
      run(() => pages.insert({ id, title, subtitle: '', position: nextPosition(all(pages)) }))
      run(() => statuses.insert(defaultStatuses(id)))
      return id
    },
    updatePage(id: string, changes: Partial<Omit<Page, 'id'>>) {
      run(() => pages.update(id, (d) => void Object.assign(d, changes)))
    },
    deletePage(id: string) {
      const sectionIds = all(sections).filter((s) => s.pageId === id).map((s) => s.id)
      const statusIds = all(statuses).filter((s) => s.pageId === id).map((s) => s.id)
      const taskIds = all(tasks).filter((t) => t.pageId === id).map((t) => t.id)
      // Server cascades; local storage does not, so children are removed explicitly in both modes
      if (taskIds.length) run(() => tasks.delete(taskIds))
      if (sectionIds.length) run(() => sections.delete(sectionIds))
      if (statusIds.length) run(() => statuses.delete(statusIds))
      run(() => pages.delete(id))
    },
    movePage(sorted: Page[], id: string, dir: -1 | 1) {
      run(() => reorderTx(pages, shift(sorted.map((p) => p.id), id, dir), 'position'))
    },
    reorderPages(ids: string[]) {
      run(() => reorderTx(pages, ids, 'position'))
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
      run(() => reorderTx(sections, shift(sorted.map((s) => s.id), id, dir), 'position'))
    },
    reorderSections(ids: string[]) {
      run(() => reorderTx(sections, ids, 'position'))
    },

    addStatus(pageId: string, draft: StatusDraft) {
      const id = newId()
      run(() => statuses.insert({ ...draft, id, pageId, position: nextPosition(pageStatuses(pageId)) }))
      return id
    },
    // Flipping a column's "done" flag re-syncs the checkbox of every task in it
    updateStatus(status: Status, changes: Partial<StatusDraft>) {
      run(() => statuses.update(status.id, (d) => void Object.assign(d, changes)))
      const done = changes.done
      if (done === undefined || done === status.done) return
      const ids = tasksInColumn(status).filter((t) => t.done !== done).map((t) => t.id)
      if (ids.length) run(() => tasks.update(ids, (ds) => ds.forEach((d) => void (d.done = done))))
    },
    // Tasks move to the neighbour column first, so nothing ends up orphaned; the last column can't be deleted
    deleteStatus(status: Status) {
      const target = neighbour(pageStatuses(status.pageId), status.id)
      if (!target) return
      const ids = tasksInColumn(status).map((t) => t.id)
      if (ids.length) run(() => tasks.update(ids, (ds) => ds.forEach((d) => void Object.assign(d, statusChanges(target)))))
      run(() => statuses.delete(status.id))
    },
    moveStatus(sorted: Status[], id: string, dir: -1 | 1) {
      run(() => reorderTx(statuses, shift(sorted.map((s) => s.id), id, dir), 'position'))
    },
    reorderStatuses(ids: string[]) {
      run(() => reorderTx(statuses, ids, 'position'))
    },

    addTask(section: Section, text: string, status?: Status) {
      const siblings = all(tasks).filter((t) => t.sectionId === section.id)
      run(() =>
        tasks.insert({
          id: newId(),
          sectionId: section.id,
          pageId: section.pageId,
          text,
          note: '',
          statusId: status?.id ?? null,
          done: status?.done ?? false,
          createdAt: new Date().toISOString(),
          position: nextPosition(siblings),
          boardPosition: boardEnd(section.pageId),
        }),
      )
    },
    // Guarded: an inline edit can blur after another device deleted the task
    updateTask(id: string, changes: Partial<Pick<Task, 'text' | 'note'>>) {
      if (tasks.has(id)) run(() => tasks.update(id, (d) => void Object.assign(d, changes)))
    },
    setTaskDone(task: Task, done: boolean) {
      setTaskState(task, doneChanges(task, pageStatuses(task.pageId), done))
    },
    setTaskStatus(task: Task, status: Status) {
      setTaskState(task, statusChanges(status))
    },
    deleteTask(id: string) {
      const task = tasks.get(id)
      run(() => tasks.delete(id))
      if (task) toast('Tarefa deletada.', { label: 'Desfazer', onClick: () => run(() => tasks.insert(task)) })
    },
    moveTask(sorted: Task[], id: string, dir: -1 | 1) {
      run(() => reorderTx(tasks, shift(sorted.map((t) => t.id), id, dir), 'position'))
    },
    // List drop: `ids` is the target section's final order; a task from another section also changes section
    reorderTasks(ids: string[], moved?: { id: string; sectionId: string }) {
      run(() => reorderTx(tasks, ids, 'position', moved ? { [moved.id]: { sectionId: moved.sectionId } } : {}))
    },
    // Board drop: `ids` is the target column's final order; a card from another column takes its status (and done)
    reorderBoard(ids: string[], moved?: { id: string; status: Status }) {
      run(() => reorderTx(tasks, ids, 'boardPosition', moved ? { [moved.id]: statusChanges(moved.status) } : {}))
    },
    // localStorage pages from before statuses existed: add the defaults and fill the new task fields, once
    upgradeLocalPage(pageId: string) {
      if (source.slug || all(statuses).some((s) => s.pageId === pageId)) return
      const defaults = defaultStatuses(pageId)
      run(() => statuses.insert(defaults))
      const doneId = defaults.find((s) => s.done)?.id ?? null
      const legacy = all(tasks).filter((t) => t.pageId === pageId && t.boardPosition === undefined)
      if (!legacy.length) return
      run(() =>
        tasks.update(
          legacy.map((t) => t.id),
          (ds) =>
            ds.forEach((d) => {
              Object.assign(d, { statusId: d.done ? doneId : null, note: d.note ?? '', createdAt: null, boardPosition: d.position })
            }),
        ),
      )
    },

    setSettings(changes: Partial<Omit<Settings, 'id'>>) {
      if (settings.has('settings')) run(() => settings.update('settings', (d) => void Object.assign(d, changes)))
      else run(() => settings.insert({ ...DEFAULT_SETTINGS, ...changes }))
    },
  }
}
```

- [ ] **Step 13: UI mínima para compilar**

1. `git rm src/components/Badge.tsx`.
2. Em `src/components/TaskRow.tsx`:
   - imports: `import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'`, `import { LIMITS, type Section, type Task } from '#/lib/types'`; remover imports de `./Badge` e `Popover` (manter `Menu, MenuItem`); remover `useState` do import se sobrar só no `NewTaskInput` (lá ele continua sendo usado — manter `useState, type FormEvent`).
   - remover `addingBadge`, `setBadges`, o `task.badges.map(...)` inteiro e o item "Adicionar badge".
   - `onChange` do checkbox: `onChange={(e) => a.setTaskDone(task, e.target.checked)}`.
   - `Menu`: remover `onClose` e o ramo `addingBadge ? ... :` — fica só o fragmento com Subir/Descer/Deletar.
3. Em `src/components/ChecklistView.tsx`, depois das três `useLiveQuery`, adicionar (com `useEffect` importado de `react`):

```ts
  // Local mode only: pages saved before statuses existed get the defaults once
  useEffect(() => {
    if (isReady && pages[0]) a.upgradeLocalPage(pageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, pages[0]?.id])
```

(Não há ESLint no projeto; o comentário pode ser omitido. `a` muda a cada render e não deve disparar o efeito.)

- [ ] **Step 14: Verificar tipos, build e testes**

Run: `npm run typecheck && npm run build && npm test`
Expected: sem erros; testes PASS.

- [ ] **Step 15: Migração no banco real (idempotência — Review Focus 5)**

1. `npm run dev` (background). Abrir `http://localhost:3000`, criar sessão `kanbanteste` (PIN 1234), criar página "Casa", seção "Hoje", 2 tarefas, marcar uma.
2. Conferir:

```bash
node --env-file=.env -e "const s=require('postgres')(process.env.DATABASE_URL);(async()=>{console.log(await s\`select st.name, st.done, st.position, (select count(*) from tasks t where t.status_id=st.id) n from statuses st join pages p on p.id=st.page_id where p.session_slug='kanbanteste' order by st.position\`);console.log(await s\`select column_name from information_schema.columns where table_name='tasks' order by 1\`);await s.end()})()"
```

Expected: 3 status (A Fazer/Em Andamento/Concluído, done só no último, Concluído com n=1); colunas de tasks incluem `board_position, created_at, note, status_id` e **não** `badges`.

3. Parar e subir o dev server de novo, fazer um request (`curl -s localhost:3000 >/dev/null`), rodar o mesmo comando. Expected: ainda **3** status (sem duplicar).

- [ ] **Step 16: Legado do modo local (Review Focus 3)**

No Playwright MCP, em `http://localhost:3000/local`, rodar via `browser_evaluate`:

```js
localStorage.setItem('checklist-local-pages', JSON.stringify({ 'p:LEGACYPAGE000001': { versionKey: 'x', data: { id: 'LEGACYPAGE000001', title: 'Antiga', subtitle: '', position: 1 } } }))
```

Antes, inspecionar o formato real que `localStorageCollectionOptions` grava (`localStorage.getItem('checklist-local-pages')` após criar uma página pela UI) e montar página + seção + 2 tarefas legadas (com `badges: [{text:'x',color:'#dc2626'}]`, sem `statusId/note/createdAt/boardPosition`, uma com `done: true`) **no mesmo formato**. Recarregar, abrir a página. Expected: sem erro no console; `checklist-local-statuses` passa a ter 3 status da página; a tarefa `done` tem `statusId` do Concluído; ambas têm `boardPosition` numérico.

- [ ] **Step 17: Commit**

Invocar a skill `auto-commit`.

---

### Task 2: Visão Lista — chip/seletor de status, notas e ditado

Entrega: chip de status clicável com lista de opções e criação de status, item "Status" e "Adicionar nota" no menu da tarefa, nota abaixo da tarefa com `line-clamp-2`, microfone em edições inline.

**Files:**
- Create: `src/components/Status.tsx`
- Modify: `src/components/InlineEdit.tsx`, `src/components/VoiceButton.tsx`, `src/components/TaskRow.tsx`, `src/components/SectionCard.tsx`, `src/components/ChecklistView.tsx`

**Interfaces:**
- Consumes: `useActions().addStatus/setTaskStatus/updateTask/setTaskDone`, `statusOf`, `chipHidden`, `STATUS_COLORS`, `LIMITS`.
- Produces: `StatusChip({ status, ...buttonProps })`, `StatusEditor({ initial?, onSave(draft), onRemove? })`, `type StatusDraft`, `StatusOptions({ task, statuses, onDone })`, `StatusPicker({ task, statuses, trigger })`, `tint(color)`; `InlineEdit` props `voice?: string`, `viewClassName?: string` (default `'inline'`); `VoiceButton` prop `label?: string` (default `'Ditar tarefa'`); `TaskRow({ task, siblings, statuses })`; `SectionCard` recebe `statuses: Status[]`.

- [ ] **Step 1: `VoiceButton` — rótulo e foco**

Em `src/components/VoiceButton.tsx`:
- assinatura: `export function VoiceButton({ value, onChange, label = 'Ditar tarefa' }: { value: string; onChange: (text: string) => void; label?: string })`
- no `<button>`: `aria-label={listening ? 'Parar ditado' : label}` e `title={listening ? 'Parar ditado' : label}`; adicionar

```tsx
      // Keep focus in the field being dictated into: blurring an inline edit would save and close it
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
```

(Comentários `//` não são permitidos entre props JSX: mover a linha `// Keep focus…` para logo antes do `return (` do componente.)

- [ ] **Step 2: `InlineEdit` — `voice` e `viewClassName`**

Em `src/components/InlineEdit.tsx`:
- import: `import { VoiceButton } from './VoiceButton'`
- props: adicionar `voice,` e `viewClassName = 'inline',` na desestruturação, e no tipo:

```ts
  /** Shows a dictation button while editing, labelled with this text */
  voice?: string
  /** Display-mode classes (default `inline`), e.g. `block line-clamp-2` */
  viewClassName?: string
```

- botão de exibição: `className={`${viewClassName} cursor-text text-left break-words ${className}`}`
- `className` do campo em edição: `` `block w-full min-w-0 rounded-md bg-accent-soft/60 px-1 -mx-1 outline-2 outline-accent/40 ${className}` ``
- trocar o `return multiline ? ... : ...` final por:

```tsx
  const field = multiline ? (
    <textarea rows={1} {...props} className={`${props.className} resize-none field-sizing-content`} />
  ) : (
    <input {...props} />
  )
  if (!voice) return field
  return (
    <span className="flex items-start gap-1">
      {field}
      <VoiceButton value={draft} onChange={setDraft} label={voice} />
    </span>
  )
```

- [ ] **Step 3: `src/components/Status.tsx`**

```tsx
import { Check, Plus } from 'lucide-react'
import { useState, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import { useActions } from '#/data/actions'
import { statusOf } from '#/lib/status'
import { LIMITS, STATUS_COLORS, type Status, type Task } from '#/lib/types'
import { Popover, type TriggerProps } from './Popover'

const COLOR_NAMES = ['Vermelho', 'Laranja', 'Âmbar', 'Verde', 'Azul', 'Roxo', 'Rosa', 'Cinza']

// Tinted from the status colour against the current surface/ink, so it works in light and dark
export const tint = (color: string) => ({
  background: `color-mix(in oklab, ${color} 16%, var(--surface))`,
  color: `color-mix(in oklab, ${color} 80%, var(--ink))`,
})

export type StatusDraft = Pick<Status, 'name' | 'color' | 'done'>

export function StatusChip({ status, className = '', ...props }: { status: Status } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      style={tint(status.color)}
      className={`inline-block rounded-md px-1.5 py-px align-[1px] text-[0.68rem] font-bold tracking-[.03em] ${className}`}
    >
      {status.name}
    </button>
  )
}

export function StatusEditor({ initial, onSave, onRemove }: { initial?: StatusDraft; onSave: (v: StatusDraft) => void; onRemove?: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? STATUS_COLORS[0])
  const [done, setDone] = useState(initial?.done ?? false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (n) onSave({ name: n, color, done })
  }
  const custom = !STATUS_COLORS.includes(color)

  return (
    <form onSubmit={submit} className="w-64 space-y-3 p-3">
      <input
        autoFocus
        value={name}
        maxLength={LIMITS.statusName}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: Revisão…"
        aria-label="Nome do status"
        autoComplete="off"
        className="w-full rounded-lg border border-line bg-ground px-3 py-2 focus-visible:border-accent focus-visible:outline-offset-0"
      />
      <div className="flex flex-wrap gap-2">
        {STATUS_COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            title={COLOR_NAMES[i]}
            aria-label={COLOR_NAMES[i]}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className="grid size-8 place-items-center rounded-full text-white ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
            style={{ background: c }}
          >
            {color === c && <Check size={15} strokeWidth={3} aria-hidden />}
          </button>
        ))}
        <label
          title="Cor personalizada"
          className={`relative size-8 cursor-pointer overflow-hidden rounded-full ring-offset-2 ring-offset-surface has-focus-visible:outline-2 has-focus-visible:outline-accent ${custom ? 'ring-2 ring-ink' : ''}`}
          style={{ background: custom ? color : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
        >
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Cor personalizada" className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
      <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" className="check" checked={done} onChange={(e) => setDone(e.target.checked)} />
        Conta como concluída
      </label>
      <div className="flex items-center justify-between gap-2">
        <span style={tint(color)} className="rounded-md px-1.5 py-px text-[0.68rem] font-bold tracking-[.03em]">
          {name.trim() || 'prévia'}
        </span>
        <div className="flex gap-2">
          {onRemove && (
            <button type="button" onClick={onRemove} className="min-h-10 rounded-lg px-3 text-warn hover:bg-warn-soft">
              Remover
            </button>
          )}
          <button disabled={!name.trim()} className="min-h-10 rounded-lg bg-accent px-3.5 font-semibold text-surface disabled:opacity-40">
            Salvar
          </button>
        </div>
      </div>
    </form>
  )
}

// The page's statuses as a single-choice list, plus "Novo status" (creates it and moves the task there)
export function StatusOptions({ task, statuses, onDone }: { task: Task; statuses: Status[]; onDone: () => void }) {
  const a = useActions()
  const [creating, setCreating] = useState(false)
  const current = statusOf(task, statuses)

  if (creating) {
    return (
      <StatusEditor
        onSave={(v) => {
          const id = a.addStatus(task.pageId, v)
          a.setTaskStatus(task, { ...v, id, pageId: task.pageId, position: 0 })
          onDone()
        }}
      />
    )
  }
  return (
    <div role="group" aria-label="Status da tarefa">
      {statuses.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={s.id === current?.id}
          onClick={() => {
            if (s.id !== current?.id) a.setTaskStatus(task, s)
            onDone()
          }}
          className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left hover:bg-accent-soft"
        >
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
          <span className="flex-1">{s.name}</span>
          {s.id === current?.id && <Check size={16} aria-hidden className="text-accent" />}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-ink-soft hover:bg-accent-soft hover:text-accent"
      >
        <Plus size={16} aria-hidden />
        Novo status
      </button>
    </div>
  )
}

export function StatusPicker({ task, statuses, trigger }: { task: Task; statuses: Status[]; trigger: (p: TriggerProps) => ReactNode }) {
  return (
    <Popover className="min-w-52 p-1" trigger={trigger}>
      {(close) => <StatusOptions task={task} statuses={statuses} onDone={close} />}
    </Popover>
  )
}
```

- [ ] **Step 4: `TaskRow` com status e nota — substituir o componente `TaskRow` (manter `NewTaskInput` como está)**

Imports do arquivo:

```tsx
import { ArrowDown, ArrowUp, CircleDot, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { chipHidden, statusOf } from '#/lib/status'
import { LIMITS, type Section, type Status, type Task } from '#/lib/types'
import { InlineEdit } from './InlineEdit'
import { Menu, MenuItem } from './Popover'
import { StatusChip, StatusOptions, StatusPicker } from './Status'
import { VoiceButton } from './VoiceButton'
```

Componente:

```tsx
export function TaskRow({ task, siblings, statuses }: { task: Task; siblings: Task[]; statuses: Status[] }) {
  const a = useActions()
  const [menu, setMenu] = useState<'actions' | 'status'>('actions')
  const [editingNote, setEditingNote] = useState(false)
  const i = siblings.findIndex((t) => t.id === task.id)
  const status = statusOf(task, statuses)

  return (
    <div className="group flex items-start gap-2.5 border-t border-line py-2 pl-1 first:border-t-0">
      <label className="-m-3 cursor-pointer p-3">
        <input
          type="checkbox"
          className="check"
          checked={task.done}
          onChange={(e) => a.setTaskDone(task, e.target.checked)}
          aria-label={`Concluída: ${task.text}`}
        />
      </label>
      <div className="min-w-0 flex-1 text-[0.92rem] leading-[1.42]">
        <InlineEdit
          value={task.text}
          required
          multiline
          maxLength={LIMITS.task}
          label="Texto da tarefa"
          onSave={(text) => a.updateTask(task.id, { text })}
          className={task.done ? 'text-ink-soft line-through decoration-ink-soft/40' : ''}
        />
        {status && !chipHidden(task, statuses) && (
          <StatusPicker
            task={task}
            statuses={statuses}
            trigger={(p) => <StatusChip {...p} status={status} aria-label={`Status: ${status.name}. Alterar`} className="ml-1.5" />}
          />
        )}
        {(task.note || editingNote) && (
          <div className="mt-0.5 text-[0.82rem] leading-snug text-ink-soft">
            <InlineEdit
              key={String(editingNote)}
              value={task.note}
              multiline
              placeholder="Nota da tarefa…"
              label="Nota da tarefa"
              maxLength={LIMITS.taskNote}
              startEditing={editingNote}
              onDone={() => setEditingNote(false)}
              onSave={(note) => a.updateTask(task.id, { note })}
              voice="Ditar nota"
              viewClassName="block line-clamp-2"
            />
          </div>
        )}
      </div>
      <Menu label="Ações da tarefa" quiet onClose={() => setMenu('actions')}>
        {(close) =>
          menu === 'status' ? (
            <StatusOptions task={task} statuses={statuses} onDone={close} />
          ) : (
            <>
              <MenuItem icon={ArrowUp} disabled={i <= 0} onClick={() => (a.moveTask(siblings, task.id, -1), close())}>
                Subir
              </MenuItem>
              <MenuItem icon={ArrowDown} disabled={i >= siblings.length - 1} onClick={() => (a.moveTask(siblings, task.id, 1), close())}>
                Descer
              </MenuItem>
              <MenuItem icon={CircleDot} onClick={() => setMenu('status')}>
                Status{status ? `: ${status.name}` : ''}
              </MenuItem>
              <MenuItem icon={StickyNote} onClick={() => (setEditingNote(true), close())}>
                {task.note ? 'Editar nota' : 'Adicionar nota'}
              </MenuItem>
              <MenuItem icon={Trash2} danger onClick={() => (a.deleteTask(task.id), close())}>
                Deletar tarefa
              </MenuItem>
            </>
          )
        }
      </Menu>
    </div>
  )
}
```

- [ ] **Step 5: Passar `statuses` adiante**

- `SectionCard`: adicionar prop `statuses: Status[]` (import `type Status`) e `<TaskRow key={t.id} task={t} siblings={tasks} statuses={statuses} />`.
- `ChecklistView`: nova live query depois da de sections:

```ts
  const { data: statuses } = useLiveQuery(
    (q) => q.from({ s: source.statuses }).where(({ s }) => eq(s.pageId, pageId)).orderBy(({ s }) => s.position),
    [source, pageId],
  )
```

  e `<SectionCard ... statuses={statuses} />`.

- [ ] **Step 6: Verificar**

Run: `npm run typecheck && npm run build && npm test`
Expected: sem erros.

- [ ] **Step 7: E2E da lista (Playwright MCP, sessão `kanbanteste`)**

1. Tarefa nova não mostra chip. Menu → "Status: A Fazer" → escolher "Em Andamento": chip azul aparece.
2. Marcar o checkbox: tarefa riscada, chip some (foi pro Concluído). Desmarcar: volta sem chip (A Fazer).
3. Chip → "Novo status" → "Revisão", cor roxa, salvar: chip "Revisão" aparece; F5 mantém.
4. Menu → "Adicionar nota" → digitar texto longo (3+ linhas) → Enter: nota aparece cortada em 2 linhas; clicar abre edição completa; Esc cancela.
5. Dark mode (Configurações) — chip e nota legíveis.

- [ ] **Step 8: Microfone mantém a edição (Review Focus 4)**

Em Chromium via Playwright: abrir edição de nota, digitar "abc", clicar no botão "Ditar nota" (a permissão de microfone pode falhar — tudo bem). Rodar `browser_evaluate` com `document.activeElement.tagName` → Expected: `TEXTAREA` (edição continua aberta, nada foi salvo). Clicar de novo no botão (para parar) e pressionar Enter → nota "abc" salva.

- [ ] **Step 9: Commit**

Invocar a skill `auto-commit`.

---

### Task 3: Infra de drag-and-drop + DnD na Lista e nas Páginas

Entrega: `dnd.tsx` reutilizável; na Lista, arrastar tarefas (inclusive entre seções) e seções pelo handle; em Páginas, arrastar páginas. Menus Subir/Descer continuam.

**Files:**
- Create: `src/components/dnd.tsx`
- Modify: `package.json` (deps), `src/styles.css`, `src/components/TaskRow.tsx`, `src/components/SectionCard.tsx`, `src/components/ChecklistView.tsx`, `src/components/PagesView.tsx`

**Interfaces:**
- Consumes: `useActions().reorderTasks/reorderSections/reorderPages`.
- Produces (`dnd.tsx`): `type Kind = 'item' | 'column'`; `SortableBoard({ columns: {id, items: string[]}[], axis?: 'x'|'y', onItemsCommit({id, from, to, order}), onColumnsCommit?(order), renderOverlay(kind, id), label(kind, id), children })`; `SortableColumns({ children: (ids) => ReactNode })`; `ColumnItems({ id, className?, children: (ids) => ReactNode })`; `useColumnItems(id): string[]`; `useSortableItem(id, roleDescription?)` e `useSortableColumn(id)` → `{ setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging }`; `dragFrom(listeners)`; `useClickGuard(): () => boolean`; `DragPreview({ children, strong? })`.

- [ ] **Step 1: Dependências**

Run: `npm install @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2`
Expected: `package.json` e `package-lock.json` atualizados, sem erro de peer.

- [ ] **Step 2: CSS (`src/styles.css`)**

Dentro do `@layer components { ... }` existente, depois do bloco `@media (hover: hover) { .row-action ... }`, adicionar:

```css
  /* Drag-and-drop: faded placeholder where the item will land, lifted copy under the pointer */
  .drag-ghost {
    opacity: 0.4;
  }
  .drag-lift {
    rotate: 1.5deg;
    scale: 1.03;
    cursor: grabbing;
    border-radius: 14px;
    box-shadow: 0 14px 34px rgb(0 0 0 / 0.22);
  }
  /* Handles are always visible on touch; on pointer devices they appear with the row */
  @media (hover: hover) {
    .drag-handle {
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .group:hover .drag-handle,
    .drag-handle:focus-visible {
      opacity: 1;
    }
  }
```

E dentro do `@media (prefers-reduced-motion: reduce) { ... }` existente, adicionar:

```css
  .drag-lift {
    rotate: none;
    scale: none;
  }
```

- [ ] **Step 3: `src/components/dnd.tsx`**

```tsx
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'

export type Kind = 'item' | 'column'
type Cols = Record<string, string[]>
type Data = { kind: Kind | 'drop'; column?: string }
type WithData = { id: string | number; data: { current?: unknown } }

const Ctx = createContext<{ items: Cols; columns: string[]; axis: 'x' | 'y'; dragging: boolean }>({
  items: {},
  columns: [],
  axis: 'y',
  dragging: false,
})
const ColumnCtx = createContext('')

let lastDrop = 0
const dataOf = (x: WithData | null | undefined) => x?.data.current as Data | undefined
const findColumn = (cols: Cols, id: string) => Object.keys(cols).find((k) => cols[k].includes(id))
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Columns only collide with columns; items with items or a column's empty area. Pointer first (mouse/touch),
// then the closest item inside the hovered column; keyboard has no pointer and falls back to closestCorners.
const collision: CollisionDetection = (args) => {
  const kind = dataOf(args.active)?.kind
  const targets = args.droppableContainers.filter((c) => {
    const k = dataOf(c)?.kind
    return kind === 'column' ? k === 'column' : k === 'item' || k === 'drop'
  })
  const scoped = { ...args, droppableContainers: targets }
  if (kind === 'column') return closestCenter(scoped)
  const hits = pointerWithin(scoped)
  const onItem = hits.filter((h) => dataOf(targets.find((c) => c.id === h.id))?.kind === 'item')
  if (onItem.length) return onItem
  if (hits.length) {
    const column = dataOf(targets.find((c) => c.id === hits[0].id))?.column
    const inColumn = targets.filter((c) => dataOf(c)?.kind === 'item' && dataOf(c)?.column === column)
    return inColumn.length ? closestCenter({ ...args, droppableContainers: inColumn }) : hits
  }
  return closestCorners(scoped)
}

export function SortableBoard({
  columns,
  axis = 'y',
  onItemsCommit,
  onColumnsCommit,
  renderOverlay,
  label,
  children,
}: {
  columns: { id: string; items: string[] }[]
  axis?: 'x' | 'y'
  /** `order` is the destination column's final order; `from !== to` when the item changed column */
  onItemsCommit: (move: { id: string; from: string; to: string; order: string[] }) => void
  onColumnsCommit?: (order: string[]) => void
  renderOverlay: (kind: Kind, id: string) => ReactNode
  /** Accessible name for announcements, lowercase: `tarefa “Pão”`, `seção “Hoje”` */
  label: (kind: Kind, id: string) => string
  children: ReactNode
}) {
  const live: Cols = Object.fromEntries(columns.map((c) => [c.id, c.items]))
  const liveColumns = columns.map((c) => c.id)
  const liveKey = JSON.stringify(columns)
  const [active, setActive] = useState<{ kind: Kind; id: string; from: string } | null>(null)
  const [order, setOrder] = useState<{ items: Cols; columns: string[] } | null>(null)
  const settling = useRef(false)

  // After a drop the final order stays on screen until the optimistic write reaches the live data (no snap-back)
  useEffect(() => {
    if (!settling.current) return
    settling.current = false
    setOrder(null)
  }, [liveKey])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Long-press on cards so scrolling still works; handles start immediately
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
      bypassActivationConstraint: ({ event }) => !!(event.target as Element | null)?.closest?.('.drag-handle'),
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )

  const items = order?.items ?? live
  const cols = order?.columns ?? liveColumns
  const kindOf = (x: WithData): Kind => (dataOf(x)?.kind === 'column' ? 'column' : 'item')
  const who = (x: WithData) => label(kindOf(x), String(x.id))
  const where = (x: WithData) => {
    const d = dataOf(x)
    return d?.kind === 'drop' ? label('column', d.column ?? '') : who(x)
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${cap(who(active))} levantada.`,
    onDragOver: ({ active, over }) => (over ? `${cap(who(active))} sobre ${where(over)}.` : `${cap(who(active))} fora de uma área válida.`),
    onDragEnd: ({ active, over }) => (over ? `${cap(who(active))} solta sobre ${where(over)}.` : `${cap(who(active))} solta.`),
    onDragCancel: ({ active }) => `Movimento cancelado. ${cap(who(active))} voltou ao lugar.`,
  }

  const reset = () => {
    lastDrop = performance.now()
    setActive(null)
  }
  // Show the final order, write it optimistically, then drop local state once the live data catches up
  const settle = (final: { items: Cols; columns: string[] } | null, commit?: () => void) => {
    if (!final || !commit) return setOrder(null)
    setOrder(final)
    settling.current = true
    commit()
    setTimeout(() => {
      if (!settling.current) return
      settling.current = false
      setOrder(null)
    }, 1000)
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id)
    setActive({ kind: kindOf(active), id, from: findColumn(live, id) ?? '' })
    setOrder({ items: live, columns: liveColumns })
  }

  // Moving between columns happens live while hovering; reordering inside a column is the sortable strategy's preview
  const onDragOver = ({ active: a, over }: DragOverEvent) => {
    const d = dataOf(over)
    if (!over || !d || kindOf(a) !== 'item') return
    const id = String(a.id)
    setOrder((prev) => {
      if (!prev) return prev
      const from = findColumn(prev.items, id)
      const to = d.kind === 'drop' ? d.column : findColumn(prev.items, String(over.id))
      if (!from || !to || from === to) return prev
      const target = prev.items[to].filter((x) => x !== id)
      const overIndex = target.indexOf(String(over.id))
      const rect = a.rect.current.translated
      const below = !!rect && rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2
      const at = overIndex < 0 ? target.length : overIndex + (below ? 1 : 0)
      const next = { ...prev.items, [from]: prev.items[from].filter((x) => x !== id), [to]: [...target.slice(0, at), id, ...target.slice(at)] }
      return { ...prev, items: next }
    })
  }

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    const id = String(a.id)
    const drag = active
    reset()
    if (!drag || !order) return settle(null)
    const overId = over ? String(over.id) : null

    if (drag.kind === 'column') {
      const next = overId && overId !== id && order.columns.includes(overId)
        ? arrayMove(order.columns, order.columns.indexOf(id), order.columns.indexOf(overId))
        : order.columns
      if (next.join() === liveColumns.join() || !onColumnsCommit) return settle(null)
      return settle({ ...order, columns: next }, () => onColumnsCommit(next))
    }

    const to = findColumn(order.items, id)
    if (!over || !to) return settle(null)
    let list = order.items[to]
    if (overId && overId !== id && list.includes(overId)) list = arrayMove(list, list.indexOf(id), list.indexOf(overId))
    if (to === drag.from && list.join() === (live[to] ?? []).join()) return settle(null)
    settle({ ...order, items: { ...order.items, [to]: list } }, () => onItemsCommit({ id, from: drag.from, to, order: list }))
  }

  const onDragCancel = () => {
    reset()
    settle(null)
  }

  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Para mover, pressione espaço. Use as setas para escolher o lugar, espaço para soltar ou Esc para cancelar.',
        },
      }}
    >
      <Ctx.Provider value={{ items, columns: cols, axis, dragging: !!active }}>{children}</Ctx.Provider>
      <DragOverlay dropAnimation={reduced ? null : { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {active && <div className="drag-lift">{renderOverlay(active.kind, active.id)}</div>}
      </DragOverlay>
    </DndContext>
  )
}

export function SortableColumns({ children }: { children: (ids: string[]) => ReactNode }) {
  const { columns, axis } = useContext(Ctx)
  return (
    <SortableContext items={columns} strategy={axis === 'x' ? horizontalListSortingStrategy : verticalListSortingStrategy}>
      {children(columns)}
    </SortableContext>
  )
}

export const useColumnItems = (id: string) => useContext(Ctx).items[id] ?? []

// A column's items plus a droppable area (so empty columns accept drops)
export function ColumnItems({ id, className, children }: { id: string; className?: string; children: (ids: string[]) => ReactNode }) {
  const ids = useColumnItems(id)
  const { setNodeRef } = useDroppable({ id: `drop:${id}`, data: { kind: 'drop', column: id } satisfies Data })
  return (
    <ColumnCtx.Provider value={id}>
      <SortableContext id={id} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={className}>
          {children(ids)}
        </div>
      </SortableContext>
    </ColumnCtx.Provider>
  )
}

const withStyle = (s: ReturnType<typeof useSortable>) => ({
  ...s,
  style: { transform: CSS.Translate.toString(s.transform), transition: s.transition },
})

export function useSortableItem(id: string, roleDescription = 'item arrastável') {
  const column = useContext(ColumnCtx)
  return withStyle(useSortable({ id, data: { kind: 'item', column } satisfies Data, attributes: { roleDescription } }))
}

export function useSortableColumn(id: string) {
  return withStyle(useSortable({ id, data: { kind: 'column' } satisfies Data, attributes: { roleDescription: 'coluna arrastável' } }))
}

type Listeners = ReturnType<typeof useSortable>['listeners']

// Pointer drags from anywhere in the element except its own controls (inputs and [data-no-drag])
export function dragFrom(listeners: Listeners) {
  const out: Record<string, (e: SyntheticEvent) => void> = {}
  for (const [name, fn] of Object.entries(listeners ?? {})) {
    out[name] = (e) => {
      if (name !== 'onKeyDown' && (e.target as Element).closest('input, textarea, select, [data-no-drag]')) return
      ;(fn as (e: SyntheticEvent) => void)(e)
    }
  }
  return out
}

// True while dragging and right after a drop: the click that ends a mouse drag (or the Space that lifts a card)
// must not also "click" what was dragged
export function useClickGuard() {
  const { dragging } = useContext(Ctx)
  return () => dragging || performance.now() - lastDrop < 250
}

export function DragPreview({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <div className={`rounded-xl border border-line bg-surface px-3 py-2 text-[0.92rem] ${strong ? 'font-display font-bold' : ''}`}>{children}</div>
  )
}
```

Notas para o implementador:
- `useSortable` só inicia arrasto por teclado quando o foco está no nó passado a `setActivatorNodeRef` (dnd-kit 6.3.1, `core.esm.js` linha ~1360) — por isso handles/botões recebem `setActivatorNodeRef`.
- `bypassActivationConstraint` existe no `TouchSensor` do 6.3.1.
- Se `onDragOver` chamar `setOrder` em loop (flicker entre colunas), guardar o último `{from,to,at}` num ref e sair cedo se igual.

- [ ] **Step 4: `TaskRow` sortable com handle**

Em `src/components/TaskRow.tsx`:
- imports: adicionar `GripVertical` ao lucide e `import { useSortableItem } from './dnd'`.
- no começo do `TaskRow`: `const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableItem(task.id, 'tarefa arrastável')`
- div raiz: `<div ref={setNodeRef} style={style} className={`group flex items-start gap-1.5 border-t border-line py-2 first:border-t-0 ${isDragging ? 'drag-ghost' : ''}`}>`
- primeiro filho (antes do `<label>` do checkbox):

```tsx
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastar tarefa: ${task.text}`}
        className="drag-handle -ml-1.5 grid h-7 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-soft"
      >
        <GripVertical size={15} aria-hidden />
      </button>
```

- no `<label>` do checkbox trocar `className="-m-3 cursor-pointer p-3"` por `className="-my-3 -mr-1 cursor-pointer py-3 pr-1"` (alvo de toque continua ≥ 40px na vertical e não sobrepõe o handle).
- no `div` do texto trocar `min-w-0 flex-1` por `ml-1 min-w-0 flex-1`.

- [ ] **Step 5: `SectionCard` sortable + `ColumnItems`**

Nova assinatura (substitui `tasks: Task[]` por `taskById`):

```tsx
export function SectionCard({
  section,
  index,
  siblings,
  taskById,
  statuses,
}: {
  section: Section
  index: number
  siblings: Section[]
  taskById: Map<string, Task>
  statuses: Status[]
}) {
  const a = useActions()
  const [editingNote, setEditingNote] = useState(false)
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableColumn(section.id)
  const i = siblings.findIndex((s) => s.id === section.id)
```

- `<section ref={setNodeRef} style={style} className={`mb-3.5 rounded-2xl border px-[18px] pt-[18px] pb-2 ${section.highlight ? '...' : '...'} ${isDragging ? 'drag-ghost' : ''}`}>`
- o `div` do cabeçalho ganha `group` e o handle como primeiro filho:

```tsx
      <div className="group mb-2.5 flex items-baseline gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar seção: ${section.title}`}
          className="drag-handle -ml-3 grid size-7 shrink-0 cursor-grab touch-none place-items-center self-center rounded-md text-ink-soft"
        >
          <GripVertical size={16} aria-hidden />
        </button>
```

- trocar `{tasks.map(...)}<NewTaskInput section={section} />` por:

```tsx
      <ColumnItems id={section.id}>
        {(ids) => {
          const tasks = ids.flatMap((id) => taskById.get(id) ?? [])
          return (
            <>
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} siblings={tasks} statuses={statuses} />
              ))}
              <NewTaskInput section={section} />
            </>
          )
        }}
      </ColumnItems>
```

- imports: `GripVertical`, `type Status`, `type Task`, `import { ColumnItems, useSortableColumn } from './dnd'`.

- [ ] **Step 6: `ChecklistView` — lista dentro do `SortableBoard`**

Imports: `import { DragPreview, SortableBoard, SortableColumns } from './dnd'`. Depois de `bySection`:

```ts
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const sectionById = new Map(sections.map((s) => [s.id, s]))
```

Trocar o `sections.map((s, i) => <SectionCard .../>)` por:

```tsx
        <SortableBoard
          columns={sections.map((s) => ({ id: s.id, items: (bySection.get(s.id) ?? []).map((t) => t.id) }))}
          onItemsCommit={({ id, from, to, order }) => a.reorderTasks(order, from !== to ? { id, sectionId: to } : undefined)}
          onColumnsCommit={a.reorderSections}
          label={(kind, id) => (kind === 'item' ? `tarefa “${taskById.get(id)?.text ?? ''}”` : `seção “${sectionById.get(id)?.title ?? ''}”`)}
          renderOverlay={(kind, id) =>
            kind === 'item' ? <DragPreview>{taskById.get(id)?.text}</DragPreview> : <DragPreview strong>{sectionById.get(id)?.title}</DragPreview>
          }
        >
          <SortableColumns>
            {(ids) =>
              ids.map((id, i) => {
                const s = sectionById.get(id)
                return s && <SectionCard key={id} section={s} index={i} siblings={sections} taskById={taskById} statuses={statuses} />
              })
            }
          </SortableColumns>
        </SortableBoard>
```

- [ ] **Step 7: `PagesView` sortable**

Extrair o card de página para `function PageCard({ page, stats, pages })` no mesmo arquivo (mesmo JSX atual do `div` do card, com o `Menu`), usando:

```tsx
function PageCard({ page: p, stats: s, pages }: { page: Page; stats: { done: number; total: number }; pages: Page[] }) {
  const source = useSource()
  const a = useActions()
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableItem(p.id, 'página arrastável')
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 rounded-2xl border border-line bg-surface p-4 pl-2 ${isDragging ? 'drag-ghost' : ''}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastar página: ${p.title}`}
        className="drag-handle grid h-7 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-soft"
      >
        <GripVertical size={16} aria-hidden />
      </button>
      {/* PageLink + Menu exatamente como hoje (movePage(pages, p.id, ±1), deletar com confirm) */}
    </div>
  )
}
```

(O comentário JSX acima indica **mover** o `<PageLink>…</PageLink>` e o `<Menu>…</Menu>` atuais para ali, sem alterar.) Em `PagesView`, trocar `pages.map(...)` por:

```tsx
        <SortableBoard
          columns={[{ id: 'pages', items: pages.map((p) => p.id) }]}
          onItemsCommit={({ order }) => a.reorderPages(order)}
          label={(_, id) => `página “${pages.find((p) => p.id === id)?.title ?? ''}”`}
          renderOverlay={(_, id) => <DragPreview strong>{pages.find((p) => p.id === id)?.title}</DragPreview>}
        >
          <ColumnItems id="pages" className="space-y-2.5">
            {(ids) =>
              ids.map((id) => {
                const p = pages.find((x) => x.id === id)
                return p && <PageCard key={id} page={p} stats={stats.get(id) ?? { done: 0, total: 0 }} pages={pages} />
              })
            }
          </ColumnItems>
        </SortableBoard>
```

`main` perde o `space-y-2.5` para o form de nova página ficar com `mt-2.5`. Imports: `GripVertical`, `type Page`, `ColumnItems, DragPreview, SortableBoard, useSortableItem` de `./dnd`.

- [ ] **Step 8: Verificar**

Run: `npm run typecheck && npm run build && npm test`
Expected: sem erros.

- [ ] **Step 9: E2E DnD Lista/Páginas (Playwright MCP, desktop 1280×800)**

Use `browser_drag` do handle até o alvo (ou `browser_run_code_unsafe` com `page.mouse.down/move(steps: 10)/up` se o drag simples não disparar os sensores).
1. Reordenar 3 tarefas numa seção → ordem muda na hora, F5 mantém.
2. Arrastar tarefa da seção A para a B (inclusive para uma seção **vazia**) → aparece em B; F5 mantém.
3. Reordenar seções pelo handle → números 1/2/3 atualizam; F5 mantém.
4. Páginas: reordenar → F5 mantém.
5. Soltar no mesmo lugar → `browser_network_requests` não mostra POST `updateTasksFn`.
6. Teclado: Tab até o handle, Espaço, ↓, Espaço → tarefa desce uma posição; leitor: `#DndLiveRegion-*` contém texto em pt-BR.
7. Viewport 390×844: handles visíveis; scroll vertical da página funciona tocando fora do handle.

- [ ] **Step 10: Commit**

Invocar a skill `auto-commit`.

---

### Task 4: Visão Quadro (Kanban) em tela cheia

Entrega: toggle Lista/Quadro via `?view=quadro`, layout largo, colunas = status com DnD de cards e colunas, criar tarefa na coluna (com microfone e seção), nova coluna, menu da coluna (nome/cor, concluída, mover, deletar), estado vazio.

**Files:**
- Create: `src/data/page-search.ts`, `src/components/ViewToggle.tsx`, `src/components/Board.tsx`
- Modify: `src/routes/s.$slug.p.$pageId.tsx`, `src/routes/local.p.$pageId.tsx`, `src/components/Shell.tsx`, `src/components/ChecklistView.tsx`

**Interfaces:**
- Consumes: `dnd.tsx` (Task 3), `Status.tsx` (Task 2), ações `reorderBoard/reorderStatuses/moveStatus/addStatus/updateStatus/deleteStatus/addTask/setTaskDone/deleteTask`, `statusOf`, `neighbour`.
- Produces: `type PageSearch = { view?: 'quadro'; task?: string }`, `validatePageSearch(s): PageSearch`, `useSetPageSearch(): (patch: PageSearch, opts?: { replace?: boolean }) => void`; `ViewToggle({ view })`; `Board({ pageId, statuses, sections, tasks, onOpen(id) })`; `ChecklistView({ pageId, view, taskId })`.

- [ ] **Step 1: `src/data/page-search.ts`**

```ts
import { useNavigate } from '@tanstack/react-router'
import { ID_RE } from '#/lib/id'

export type PageSearch = { view?: 'quadro'; task?: string }

// Shared by /s/$slug/p/$pageId and /local/p/$pageId; anything unexpected is dropped
export const validatePageSearch = (s: Record<string, unknown>): PageSearch => ({
  view: s.view === 'quadro' ? 'quadro' : undefined,
  task: typeof s.task === 'string' && ID_RE.test(s.task) ? s.task : undefined,
})

export function useSetPageSearch() {
  const navigate = useNavigate()
  // ponytail: untyped relative navigate because one view serves two routes; type it per route if they diverge
  return (patch: PageSearch, opts: { replace?: boolean } = {}) =>
    navigate({ to: '.', search: (prev: PageSearch) => ({ ...prev, ...patch }), ...opts } as never)
}
```

- [ ] **Step 2: Rotas**

`src/routes/s.$slug.p.$pageId.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { ChecklistView } from '#/components/ChecklistView'
import { validatePageSearch } from '#/data/page-search'

export const Route = createFileRoute('/s/$slug/p/$pageId')({ validateSearch: validatePageSearch, component: Page })

function Page() {
  const { pageId } = Route.useParams()
  const { view, task } = Route.useSearch()
  return <ChecklistView pageId={pageId} view={view} taskId={task} />
}
```

`src/routes/local.p.$pageId.tsx`: idêntico com `'/local/p/$pageId'`.

Se o `typecheck` passar a exigir `search` nos `<Link>` de `links.tsx`, adicionar `search={{}}` em `PageLink` (os dois ramos).

- [ ] **Step 3: `Shell` largo**

```tsx
import { useSearch } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useApplyTheme } from '#/data/theme'

export function Shell({ children }: { children: ReactNode }) {
  useApplyTheme()
  // The board uses the whole window; everything else keeps the reading width
  const { view } = useSearch({ strict: false }) as { view?: string }
  return <div className={`mx-auto px-4 pb-12 ${view === 'quadro' ? 'max-w-none sm:px-6' : 'max-w-[720px]'}`}>{children}</div>
}
```

(`NotFound` fica igual.)

- [ ] **Step 4: `src/components/ViewToggle.tsx`**

```tsx
import { Columns3, List } from 'lucide-react'
import { useSetPageSearch, type PageSearch } from '#/data/page-search'

const OPTIONS = [
  { view: undefined, label: 'Lista', icon: List },
  { view: 'quadro', label: 'Quadro', icon: Columns3 },
] as const

export function ViewToggle({ view }: { view: PageSearch['view'] }) {
  const setSearch = useSetPageSearch()
  return (
    <fieldset className="m-0 flex shrink-0 gap-0.5 rounded-xl border border-line bg-surface p-0.5">
      <legend className="sr-only">Visualização</legend>
      {OPTIONS.map((o) => (
        <label
          key={o.label}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-ink-soft hover:text-ink has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:outline-2 has-focus-visible:outline-accent"
        >
          <input type="radio" name="view" className="sr-only" checked={view === o.view} onChange={() => setSearch({ view: o.view, task: undefined })} />
          <o.icon size={16} aria-hidden />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}
```

- [ ] **Step 5: `src/components/Board.tsx`**

```tsx
import { ArrowLeft, ArrowRight, CheckCheck, CircleDot, GripVertical, Palette, Plus, StickyNote, Trash2, X } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useActions } from '#/data/actions'
import { useSetPageSearch } from '#/data/page-search'
import { neighbour, statusOf } from '#/lib/status'
import { LIMITS, type Section, type Status, type Task } from '#/lib/types'
import { ColumnItems, DragPreview, SortableBoard, SortableColumns, dragFrom, useClickGuard, useColumnItems, useSortableColumn, useSortableItem } from './dnd'
import { InlineEdit } from './InlineEdit'
import { Menu, MenuItem, Popover } from './Popover'
import { StatusEditor, StatusOptions } from './Status'
import { VoiceButton } from './VoiceButton'

const COLUMN_W = 'w-[min(85vw,300px)]'

export function Board({
  pageId,
  statuses,
  sections,
  tasks,
  onOpen,
}: {
  pageId: string
  statuses: Status[]
  sections: Section[]
  tasks: Task[]
  onOpen: (taskId: string) => void
}) {
  const a = useActions()
  const setSearch = useSetPageSearch()

  if (!sections.length) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-line p-8 text-center">
        <p className="m-0 font-semibold">Nenhuma seção ainda</p>
        <p className="m-0 mt-1 text-sm text-ink-soft">O quadro organiza as tarefas das seções. Crie uma seção na lista primeiro.</p>
        <button type="button" onClick={() => setSearch({ view: undefined })} className="mt-4 min-h-10 rounded-xl bg-accent px-4 font-semibold text-surface">
          Ir para a lista
        </button>
      </div>
    )
  }

  const byId = new Map(tasks.map((t) => [t.id, t]))
  const statusById = new Map(statuses.map((s) => [s.id, s]))
  const columns = statuses.map((s) => ({ id: s.id, items: [] as string[] }))
  const column = new Map(columns.map((c) => [c.id, c]))
  for (const t of [...tasks].sort((x, y) => x.boardPosition - y.boardPosition)) {
    const s = statusOf(t, statuses)
    if (s) column.get(s.id)?.items.push(t.id)
  }
  // Section names on cards only help when there is more than one section
  const sectionTitle = sections.length > 1 ? new Map(sections.map((s) => [s.id, s.title])) : null

  return (
    <SortableBoard
      axis="x"
      columns={columns}
      onItemsCommit={({ id, from, to, order }) => {
        const status = statusById.get(to)
        a.reorderBoard(order, from !== to && status ? { id, status } : undefined)
      }}
      onColumnsCommit={a.reorderStatuses}
      label={(kind, id) => (kind === 'item' ? `tarefa “${byId.get(id)?.text ?? ''}”` : `coluna “${statusById.get(id)?.name ?? ''}”`)}
      renderOverlay={(kind, id) => {
        const t = byId.get(id)
        if (kind === 'item') return t && <CardFace task={t} sectionTitle={sectionTitle?.get(t.sectionId)} />
        return <DragPreview strong>{statusById.get(id)?.name}</DragPreview>
      }}
    >
      <div className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-4 px-4 pb-6 sm:-mx-6 sm:snap-none sm:px-6">
        <SortableColumns>
          {(ids) =>
            ids.map((id) => {
              const s = statusById.get(id)
              return s && <Column key={id} status={s} statuses={statuses} sections={sections} byId={byId} sectionTitle={sectionTitle} onOpen={onOpen} />
            })
          }
        </SortableColumns>
        <NewColumn pageId={pageId} />
      </div>
    </SortableBoard>
  )
}

function Column({
  status,
  statuses,
  sections,
  byId,
  sectionTitle,
  onOpen,
}: {
  status: Status
  statuses: Status[]
  sections: Section[]
  byId: Map<string, Task>
  sectionTitle: Map<string, string> | null
  onOpen: (taskId: string) => void
}) {
  const a = useActions()
  const [editing, setEditing] = useState(false)
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableColumn(status.id)
  const count = useColumnItems(status.id).length
  const i = statuses.findIndex((s) => s.id === status.id)

  const remove = () => {
    const target = neighbour(statuses, status.id)
    if (!target) return
    const moving = count === 1 ? '1 tarefa vai' : `${count} tarefas vão`
    if (count === 0 || confirm(`Deletar a coluna “${status.name}”? ${moving} para “${target.name}”.`)) a.deleteStatus(status)
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      aria-label={`${status.name}, ${count} ${count === 1 ? 'tarefa' : 'tarefas'}`}
      className={`flex ${COLUMN_W} shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface/50 ${isDragging ? 'drag-ghost' : ''}`}
    >
      <header className="group flex items-center gap-1.5 px-2 pt-2 pb-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar coluna: ${status.name}`}
          className="drag-handle grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-soft"
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: status.color }} />
        <h2 className="m-0 min-w-0 flex-1 truncate text-[0.95rem] font-bold">
          <InlineEdit value={status.name} required maxLength={LIMITS.statusName} label="Nome da coluna" onSave={(name) => a.updateStatus(status, { name })} />
        </h2>
        <span aria-hidden className="rounded-full bg-line/70 px-2 text-xs font-bold tabular-nums text-ink-soft">
          {count}
        </span>
        <Menu label={`Ações da coluna ${status.name}`} onClose={() => setEditing(false)}>
          {(close) =>
            editing ? (
              <StatusEditor initial={status} onSave={(v) => (a.updateStatus(status, v), close())} />
            ) : (
              <>
                <MenuItem icon={Palette} onClick={() => setEditing(true)}>
                  Editar nome e cor
                </MenuItem>
                <MenuItem icon={CheckCheck} onClick={() => (a.updateStatus(status, { done: !status.done }), close())}>
                  {status.done ? 'Não conta como concluída' : 'Conta como concluída'}
                </MenuItem>
                <MenuItem icon={ArrowLeft} disabled={i <= 0} onClick={() => (a.moveStatus(statuses, status.id, -1), close())}>
                  Mover para a esquerda
                </MenuItem>
                <MenuItem icon={ArrowRight} disabled={i >= statuses.length - 1} onClick={() => (a.moveStatus(statuses, status.id, 1), close())}>
                  Mover para a direita
                </MenuItem>
                <MenuItem icon={Trash2} danger disabled={statuses.length <= 1} onClick={() => (close(), remove())}>
                  Deletar coluna
                </MenuItem>
              </>
            )
          }
        </Menu>
      </header>
      <ColumnItems id={status.id} className="flex min-h-16 flex-col gap-2 px-2 pb-2">
        {(ids) =>
          ids.map((id) => {
            const t = byId.get(id)
            return t && <Card key={id} task={t} statuses={statuses} sectionTitle={sectionTitle?.get(t.sectionId)} onOpen={onOpen} />
          })
        }
      </ColumnItems>
      <AddCard status={status} sections={sections} />
    </section>
  )
}

function CardFace({ task, sectionTitle }: { task: Task; sectionTitle?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5 text-[0.9rem] leading-snug">
      <p className={`m-0 line-clamp-3 break-words ${task.done ? 'text-ink-soft line-through' : ''}`}>{task.text}</p>
      {sectionTitle && <p className="m-0 mt-1.5 truncate text-[0.75rem] text-ink-soft">{sectionTitle}</p>}
    </div>
  )
}

function Card({ task, statuses, sectionTitle, onOpen }: { task: Task; statuses: Status[]; sectionTitle?: string; onOpen: (id: string) => void }) {
  const a = useActions()
  const [menu, setMenu] = useState<'actions' | 'status'>('actions')
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, isDragging } = useSortableItem(task.id, 'cartão arrastável')
  const blocked = useClickGuard()

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...dragFrom(listeners)}
      className={`group cursor-grab rounded-xl border border-line bg-surface p-2.5 shadow-sm transition-shadow hover:shadow-md ${isDragging ? 'drag-ghost' : ''}`}
    >
      <div className="flex items-start gap-2">
        <label data-no-drag className="-m-2 cursor-pointer p-2">
          <input type="checkbox" className="check" checked={task.done} onChange={(e) => a.setTaskDone(task, e.target.checked)} aria-label={`Concluída: ${task.text}`} />
        </label>
        {/* Enter opens the details; Space lifts the card (keyboard drag starts only from this activator) */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          aria-haspopup="dialog"
          onClick={() => {
            if (!blocked()) onOpen(task.id)
          }}
          className={`min-w-0 flex-1 cursor-pointer text-left text-[0.9rem] leading-snug break-words line-clamp-3 ${task.done ? 'text-ink-soft line-through decoration-ink-soft/40' : ''}`}
        >
          {task.text}
        </button>
        <span data-no-drag className="-my-1.5">
          <Menu label="Ações da tarefa" quiet onClose={() => setMenu('actions')}>
            {(close) =>
              menu === 'status' ? (
                <StatusOptions task={task} statuses={statuses} onDone={close} />
              ) : (
                <>
                  <MenuItem icon={CircleDot} onClick={() => setMenu('status')}>
                    Mover para…
                  </MenuItem>
                  <MenuItem icon={Trash2} danger onClick={() => (a.deleteTask(task.id), close())}>
                    Deletar tarefa
                  </MenuItem>
                </>
              )
            }
          </Menu>
        </span>
      </div>
      {(sectionTitle || task.note) && (
        <div className="mt-1.5 flex items-center gap-2 pl-7 text-[0.75rem] text-ink-soft">
          {sectionTitle && <span className="min-w-0 truncate">{sectionTitle}</span>}
          {task.note && <StickyNote size={13} role="img" aria-label="Tem descrição" className="shrink-0" />}
        </div>
      )}
    </article>
  )
}

function AddCard({ status, sections }: { status: Status; sections: Section[] }) {
  const a = useActions()
  const key = `checklist-board-section-${status.pageId}`
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sectionId, setSectionId] = useState(() => {
    try {
      return localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  })
  const input = useRef<HTMLInputElement>(null)
  const section = sections.find((s) => s.id === sectionId) ?? sections[0]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    a.addTask(section, v, status)
    setText('')
    input.current?.focus()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-2 mb-2 flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm text-ink-soft hover:bg-accent-soft hover:text-accent"
      >
        <Plus size={16} aria-hidden />
        Adicionar tarefa
      </button>
    )
  }
  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
      className="mx-2 mb-2 space-y-2 rounded-xl border border-accent bg-surface p-2"
    >
      <div className="flex items-center gap-1">
        <input
          ref={input}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LIMITS.task}
          placeholder="Nova tarefa…"
          aria-label={`Nova tarefa em ${status.name}`}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1.5 text-[0.9rem] outline-none placeholder:text-ink-soft"
        />
        <VoiceButton value={text} onChange={setText} />
      </div>
      <div className="flex items-center gap-2">
        {sections.length > 1 && (
          <select
            value={section.id}
            onChange={(e) => {
              setSectionId(e.target.value)
              try {
                localStorage.setItem(key, e.target.value)
              } catch {}
            }}
            aria-label="Seção"
            className="min-h-9 min-w-0 flex-1 rounded-lg border border-line bg-ground px-2 text-sm"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
        <button disabled={!text.trim()} className="ml-auto min-h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-surface disabled:opacity-40">
          Adicionar
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-accent-soft">
          <X size={16} aria-hidden />
        </button>
      </div>
    </form>
  )
}

function NewColumn({ pageId }: { pageId: string }) {
  const a = useActions()
  return (
    <Popover
      trigger={(p) => (
        <button
          {...p}
          className={`flex min-h-12 ${COLUMN_W} shrink-0 snap-start items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm font-semibold text-ink-soft hover:border-accent hover:text-accent`}
        >
          <Plus size={16} aria-hidden />
          Nova coluna
        </button>
      )}
    >
      {(close) => <StatusEditor onSave={(v) => (a.addStatus(pageId, v), close())} />}
    </Popover>
  )
}
```

- [ ] **Step 6: `ChecklistView` — toggle e Quadro**

- assinatura: `export function ChecklistView({ pageId, view }: { pageId: string; view?: 'quadro'; taskId?: string })` — o tipo já aceita `taskId` (as rotas passam), mas ele só é desestruturado na Task 5 (evita `noUnusedLocals`).
- header: trocar `<ProgressBar done={done} total={tasks.length} />` por:

```tsx
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <ProgressBar done={done} total={tasks.length} />
          </div>
          <ViewToggle view={view} />
        </div>
```

- `main`: se `view === 'quadro'`, renderizar
  `<Board pageId={page.id} statuses={statuses} sections={sections} tasks={tasks} onOpen={() => {}} />`
  no lugar da lista (texto de vazio + `SortableBoard` da lista + `NewSection`); senão, a lista como está. (Task 5 troca o `onOpen` stub.)
- imports: `Board`, `ViewToggle`.

- [ ] **Step 7: E2E do Quadro (Playwright MCP) — cobre Review Focus 1 e 2**

Sessão `kanbanteste`, página com 2 seções e ~6 tarefas, desktop 1440×900:
1. Clicar "Quadro": URL ganha `?view=quadro`, conteúdo ocupa a largura toda, 3 colunas com contadores corretos. Voltar do navegador volta para Lista.
2. Arrastar card de A Fazer → Em Andamento (meio da lista): card aparece na posição solta, sem "pulo"; contadores atualizam; F5 mantém; na Lista o chip "Em Andamento" aparece na tarefa e a **ordem da Lista não mudou**.
3. Arrastar card para Concluído → checkbox marcado + riscado; progresso sobe. Desmarcar no card → volta para A Fazer.
4. Reordenar dentro da coluna; reordenar colunas pelo handle; F5 mantém ambos.
5. "Adicionar tarefa" em Em Andamento com seção B escolhida → card aparece no fim da coluna; na Lista aparece na seção B. Recarregar: select lembra a seção B.
6. "Nova coluna" → "Revisão" → aparece no fim. Menu da coluna → "Conta como concluída" com 1 card dentro → card fica marcado.
7. Soltar um card no mesmo lugar: nenhum POST, **modal não abre** (na Task 5 conferir de novo). Deletar coluna com 2 cards → confirm menciona "2 tarefas vão para …", cards aparecem na vizinha. Com uma só coluna, "Deletar coluna" fica desabilitado.
8. Viewport 390×844: colunas com snap horizontal; long-press (≥180ms) num card inicia arrasto; swipe rápido rola o quadro sem arrastar. (Se o MCP não emular touch, marcar este item para verificação manual no celular e registrar no relatório.)
9. Página sem seções → estado vazio com "Ir para a lista".

- [ ] **Step 8: Verificar e commitar**

Run: `npm run typecheck && npm run build && npm test` → sem erros. Invocar `auto-commit`.

---

### Task 5: Modal de detalhes da tarefa (só no Quadro)

Entrega: clicar (ou Enter) num card abre `<dialog>` com checkbox, título editável com microfone, status, seção, data de criação e descrição com microfone; estado em `?task=`; voltar do celular fecha; bottom sheet no mobile.

**Files:**
- Create: `src/components/TaskDialog.tsx`
- Modify: `src/components/ChecklistView.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `useSetPageSearch`, `useActions().updateTask/setTaskDone/deleteTask`, `StatusChip`, `StatusPicker`, `InlineEdit` (`voice`), `VoiceButton` (`label`), `statusOf`.
- Produces: `TaskDialog({ task, statuses, section?, onClose })`.

- [ ] **Step 1: CSS do diálogo (`src/styles.css`, fim do arquivo)**

```css
/* Task details: centred dialog on desktop, bottom sheet on phones */
.task-dialog {
  width: min(560px, calc(100vw - 32px));
  max-height: min(85dvh, 760px);
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 24px 60px rgb(0 0 0 / 0.25);
  overflow: hidden;
}
.task-dialog[open] {
  animation: dialog-in 0.18s ease-out;
}
.task-dialog::backdrop {
  background: rgb(0 0 0 / 0.45);
}
@keyframes dialog-in {
  from {
    opacity: 0;
    translate: 0 8px;
    scale: 0.98;
  }
}
@media (max-width: 640px) {
  .task-dialog {
    width: 100%;
    max-width: 100%;
    max-height: 90dvh;
    margin: auto 0 0;
    border-bottom: 0;
    border-radius: 20px 20px 0 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .task-dialog[open] {
    animation: sheet-up 0.24s ease-out;
  }
}
@keyframes sheet-up {
  from {
    translate: 0 100%;
  }
}
```

(A regra global de `prefers-reduced-motion` já zera as animações.)

- [ ] **Step 2: `src/components/TaskDialog.tsx`**

```tsx
import { Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useActions } from '#/data/actions'
import { statusOf } from '#/lib/status'
import { LIMITS, type Section, type Status, type Task } from '#/lib/types'
import { InlineEdit } from './InlineEdit'
import { StatusChip, StatusPicker } from './Status'
import { VoiceButton } from './VoiceButton'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })
const relFmt = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

function relative(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, n] of UNITS) if (Math.abs(s) >= n) return relFmt.format(Math.round(s / n), unit)
  return 'agora'
}

// Every way of closing (X, Esc, backdrop) goes through dialog.close() → onClose; the note is saved on blur and on unmount
export function TaskDialog({ task, statuses, section, onClose }: { task: Task; statuses: Status[]; section?: Section; onClose: () => void }) {
  const a = useActions()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const noteId = useId()
  const [note, setNote] = useState(task.note)
  const latest = useRef({ note, task })
  latest.current = { note, task }
  const status = statusOf(task, statuses)

  const saveNote = () => {
    const { note, task } = latest.current
    const v = note.trim()
    if (v !== task.note) a.updateTask(task.id, { note: v })
  }

  useEffect(() => {
    ref.current?.showModal()
    return saveNote
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close()
      }}
      className="task-dialog"
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start gap-3 border-b border-line p-4 pr-3">
          <label className="-m-2 mt-0 cursor-pointer p-2">
            <input type="checkbox" className="check" checked={task.done} onChange={(e) => a.setTaskDone(task, e.target.checked)} aria-label="Concluída" />
          </label>
          <h2 id={titleId} className="m-0 min-w-0 flex-1 text-[1.15rem] leading-snug font-bold">
            <InlineEdit
              value={task.text}
              required
              multiline
              maxLength={LIMITS.task}
              label="Título da tarefa"
              voice="Ditar título"
              onSave={(text) => a.updateTask(task.id, { text })}
              className={task.done ? 'text-ink-soft line-through decoration-ink-soft/40' : ''}
            />
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Fechar"
            className="-mt-1.5 grid size-10 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-accent"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2.5 text-sm">
            <dt className="text-ink-soft">Status</dt>
            <dd className="m-0">
              {status && (
                <StatusPicker
                  task={task}
                  statuses={statuses}
                  trigger={(p) => <StatusChip {...p} status={status} aria-label={`Status: ${status.name}. Alterar`} className="px-2 py-0.5 text-[0.75rem]" />}
                />
              )}
            </dd>
            {section && (
              <>
                <dt className="text-ink-soft">Seção</dt>
                <dd className="m-0">{section.title}</dd>
              </>
            )}
            {task.createdAt && (
              <>
                <dt className="text-ink-soft">Criada</dt>
                <dd className="m-0">
                  <time dateTime={task.createdAt}>{dateFmt.format(new Date(task.createdAt))}</time>
                  <span className="text-ink-soft"> · {relative(task.createdAt)}</span>
                </dd>
              </>
            )}
          </dl>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor={noteId} className="text-sm font-semibold">
                Descrição
              </label>
              <VoiceButton value={note} onChange={setNote} label="Ditar descrição" />
            </div>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              maxLength={LIMITS.taskNote}
              placeholder="Adicione uma descrição…"
              className="block min-h-28 w-full resize-none rounded-xl border border-line bg-ground p-3 text-[0.92rem] leading-relaxed field-sizing-content focus-visible:border-accent focus-visible:outline-offset-0"
            />
            {note.length > LIMITS.taskNote - 200 && (
              <p className="m-0 mt-1 text-right text-xs tabular-nums text-ink-soft">
                {note.length}/{LIMITS.taskNote}
              </p>
            )}
          </div>
        </div>

        <footer className="flex justify-end border-t border-line p-3">
          <button
            type="button"
            onClick={() => {
              a.deleteTask(task.id)
              ref.current?.close()
            }}
            className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-warn hover:bg-warn-soft"
          >
            <Trash2 size={16} aria-hidden />
            Deletar tarefa
          </button>
        </footer>
      </div>
    </dialog>
  )
}
```

(`saveNote` no unmount depois de deletar é seguro: `updateTask` ignora ids que não existem mais.)

- [ ] **Step 3: Ligar no `ChecklistView`**

- assinatura: `{ pageId, view, taskId }: { pageId: string; view?: 'quadro'; taskId?: string }`.
- imports: `useRef` de react, `useRouter` de `@tanstack/react-router`, `useSetPageSearch` de `#/data/page-search`, `TaskDialog`.
- a query de tasks passa a expor `isReady`: `const { data: tasks, isReady: tasksReady } = useLiveQuery(...)`.
- **antes** do `if (!page)` (hooks não podem ficar depois do return antecipado):

```ts
  const setSearch = useSetPageSearch()
  const router = useRouter()
  // Opened from a card → closing goes back (so the phone's back button and X agree);
  // opened from a shared link → closing replaces, so we never navigate out of the app
  const openedHere = useRef(false)
  // Set while our own navigation away from ?task= is in flight, so nothing navigates twice
  const closing = useRef(false)
  const openTask = (id: string) => {
    openedHere.current = true
    setSearch({ task: id })
  }
  const closeTask = () => {
    // Already gone from the URL (Back was pressed) or already closing: nothing to undo
    if (closing.current || !new URLSearchParams(location.search).has('task')) return
    closing.current = true
    if (openedHere.current) router.history.back()
    else setSearch({ task: undefined }, { replace: true })
  }
  const dialogTask = view === 'quadro' && taskId ? tasks.find((t) => t.id === taskId) : undefined

  useEffect(() => {
    if (!taskId) {
      openedHere.current = false
      closing.current = false
    } else if (tasksReady && !closing.current && !tasks.some((t) => t.id === taskId)) {
      // Task deleted on another device while its dialog is open, or a stale link
      closeTask()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, tasksReady, tasks])
```

- `<Board ... onOpen={openTask} />`
- no fim do fragmento retornado (depois do `footer`):

```tsx
      {dialogTask && (
        <TaskDialog
          key={dialogTask.id}
          task={dialogTask}
          statuses={statuses}
          section={sections.find((s) => s.id === dialogTask.sectionId)}
          onClose={closeTask}
        />
      )}
```

Por que `closing`: no delete pelo modal, `dialog.close()` dispara `onClose` → `closeTask`, e logo depois o efeito vê a tarefa sumir — sem a guarda, a navegação aconteceria duas vezes (e um `history.back()` extra sairia da página).

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npm run build && npm test` → sem erros.

- [ ] **Step 5: E2E do modal (Playwright MCP)**

Desktop 1280×800, `?view=quadro`:
1. Clicar num card → modal centralizado; URL tem `task=<id>`; foco dentro do modal; título, status, seção e "Criada …· há …" visíveis (tarefa criada nesta sessão).
2. Editar a descrição, clicar fora do textarea → card mostra ícone de nota; F5 com `?task=` reabre o modal com a descrição.
3. Esc fecha; clique no backdrop fecha; X fecha; em todos os casos `task` sai da URL e **Voltar** do navegador não reabre o modal (abriu pelo card).
4. Abrir o modal, pressionar Voltar do navegador → fecha; digitar algo na descrição antes → foi salvo.
5. Chip de status no modal → trocar para Concluído → card muda de coluna por trás, checkbox marcado no modal.
6. Deletar pelo modal → fecha uma vez só (URL sem `task`, ainda na página), toast "Desfazer" funciona.
7. Link com `?view=quadro&task=<id inexistente>` → sem modal, `task` removido da URL. Link `?task=<id>` **sem** `view=quadro` → nenhum modal (só Quadro).
8. Teclado: Tab até um card, Enter → abre modal; Esc → fecha e o foco volta ao card.
9. Viewport 390×844 → bottom sheet colado embaixo, cantos superiores arredondados, conteúdo rola dentro.
10. Arrastar card e soltar no mesmo lugar → modal **não** abre.

- [ ] **Step 6: Commit**

Invocar a skill `auto-commit`.

---

### Task 6: Validação de UX/a11y e React, correções finais

Entrega: auditoria com as skills do projeto aplicada, E2E de regressão completo nos dois modos, build Docker ok.

**Files:** os que as auditorias apontarem (apenas os tocados neste plano).

- [ ] **Step 1: `web-design-guidelines`**

Invocar a skill `web-design-guidelines` sobre: `src/components/{Board,TaskDialog,Status,ViewToggle,TaskRow,SectionCard,PagesView,ChecklistView,InlineEdit,VoiceButton,dnd}.tsx` e `src/styles.css`. Aplicar todas as correções pertinentes (foco visível, alvos ≥ 40px, labels, contraste, reduced-motion, `aria-*`). Discordâncias ficam registradas no relatório com o motivo.

- [ ] **Step 2: `react-doctor`**

Invocar a skill `react-doctor` (escopo: arquivos alterados neste branch). Corrigir erros e warnings relevantes (keys, hooks, re-renders óbvios). Não introduzir memoização especulativa.

- [ ] **Step 3: Verificação completa**

Run: `npm run typecheck && npm run build && npm test` → sem erros.

- [ ] **Step 4: Regressão E2E (Playwright MCP)**

Modo **local** (`/local`) e modo **sessão**, desktop e 390×844: criar página (vem com 3 status), seção, tarefas por texto e fluxo básico do microfone (botão visível no Chromium); marcar/desmarcar; Lista↔Quadro; DnD Lista, Quadro, colunas e páginas; modal; tema escuro; nenhum erro no console (`browser_console_messages`). Deletar a sessão de teste `kanbanteste` ao final (Configurações → Deletar sessão).

- [ ] **Step 5: Docker**

Run: `docker build -t checklist-kanban .` (se o Docker estiver disponível). Expected: build ok (`npm ci` aceita o lockfile com @dnd-kit). Se `npm ci` falhar por lockfile, regenerar o lock como na correção anterior (npm dentro de `node:24-alpine`) e registrar.

- [ ] **Step 6: Commit**

Invocar a skill `auto-commit`.

# Kanban, status por página, notas e drag-and-drop — Design

Data: 2026-09-23 · Status: aguardando revisão

## Objetivo

Pedido de uso real (casal usando o checklist no dia a dia):

1. Adicionar **notas (descrição)** dentro de uma tarefa, digitadas ou **ditadas pelo microfone** — igual ao texto da tarefa.
2. Ter uma **visão Kanban** das tarefas de uma página, com colunas = status.
3. **Drag-and-drop** em todo o sistema, com atualização otimista e animação fluida.

Restrição central: **não quebrar o fluxo atual**. A visão Lista continua sendo o padrão e quem não usa
o Quadro não percebe diferença além do status e da nota.

### Critérios de sucesso

- Marcar/desmarcar tarefa, progresso e sincronização entre aparelhos continuam funcionando como hoje.
- No celular, arrastar não conflita com scroll nem com edição inline.
- Toda ação aparece instantaneamente (otimista) e desfaz sozinha com toast de "Tentar de novo" se o servidor falhar.
- Modos **sessão** (Postgres) e **local** (localStorage) têm paridade total.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Colunas do Kanban | Os **status** da página (substituem os badges livres) |
| Status padrão | Toda página nasce com **A Fazer**, **Em Andamento**, **Concluído**; cada página pode criar/editar/remover os seus |
| Status por tarefa | Exatamente **1** |
| Badges livres antigos | **Descartados** (coluna `badges` removida) |
| Checkbox ↔ status | **Sincronizados** via flag `done` do status |
| Notas | Campo `note` na tarefa, com ditado por voz |
| Modal de detalhes | **Só na visão Quadro**: clicar no card abre modal com título, data de criação, status, seção e descrição |
| DnD | Kanban (cards e colunas), Lista (tarefas, mover entre seções, seções) e Lista de páginas |
| Lib de DnD | `@dnd-kit/core` 6 + `@dnd-kit/sortable` 10 (touch + teclado + anúncios a11y; HTML5 DnD nativo não funciona em touch) |
| Largura | Visão Quadro ocupa a tela toda (sem `max-w-[720px]`) |

## 1. Modelo de dados

### Postgres (`src/server/schema.sql`, idempotente — roda a cada boot via `db()`)

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

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_id  text REFERENCES statuses ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS note       text NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at timestamptz;   -- tarefas antigas ficam NULL
```

Migração de dados (idempotente, executada em bloco `DO $$ … $$` no mesmo arquivo):

1. Para cada página **sem nenhum status**, insere os 3 padrões (ids de 16 chars `[A-Za-z0-9]`
   gerados em SQL, compatíveis com `ID_RE`):
   - `A Fazer` · `#6b7280` · done=false · position 1
   - `Em Andamento` · `#2563eb` · done=false · position 2
   - `Concluído` · `#16a34a` · done=true · position 3
2. Tarefas com `done = true` e `status_id IS NULL` recebem o status `done=true` de menor posição da sua página.
3. `ALTER TABLE tasks DROP COLUMN IF EXISTS badges;`

> ⚠️ O passo 3 apaga definitivamente os badges livres existentes. Fazer `pg_dump` antes do deploy se quiser guardá-los.

`created_at` não tem default no banco: o cliente envia o timestamp ISO no insert (necessário para o
modo local e para o modal mostrar a data já no estado otimista). Tarefas antigas ficam `NULL` e o modal
simplesmente não mostra a linha de data.

### Tipos (`src/lib/types.ts`)

```ts
export type Status = { id: string; pageId: string; name: string; color: string; done: boolean; position: number }
export type Task = {
  id: string; sectionId: string; pageId: string; text: string; done: boolean
  statusId: string | null; note: string; createdAt: string | null; position: number
}
export const DEFAULT_STATUSES = [
  { name: 'A Fazer', color: '#6b7280', done: false },
  { name: 'Em Andamento', color: '#2563eb', done: false },
  { name: 'Concluído', color: '#16a34a', done: true },
] as const
```

- `Badge`, `LIMITS.badges` somem. `LIMITS.badgeText` vira `LIMITS.statusName` (30).
- Novo `LIMITS.taskNote = 2000` (descrição pode ser maior que a nota de seção).
- `BADGE_COLORS` continua (paleta dos status).

### Resolução de status (função pura, `src/lib/status.ts`)

```ts
statusOf(task, statuses)   // statuses da página, ordenados; statusId null/inexistente → statuses[0]
firstDone(statuses)        // primeiro com done=true, ou undefined
firstOpen(statuses)        // primeiro com done=false, ou undefined
```

Por que `ON DELETE SET NULL` + fallback em vez de reatribuir no servidor: se uma coluna for apagada
em outro aparelho, nenhuma tarefa fica órfã ou some do quadro — ela aparece na primeira coluna.

### Servidor (`src/server/data.ts`, `validate.ts`)

- `listStatusesFn`, `insertStatusesFn`, `updateStatusesFn`, `deleteStatusesFn` — mesmo padrão de `sections`
  (checagem de posse pela `session_slug` da página).
- `statusFields = { name: str(30), color, done: bool, position: int }` (`color` já existe em `validate.ts`).
- `taskFields` troca `badges` por `statusId: nullable(id)`, `note: str(2000)`, `createdAt: nullable(isoDate)`.
- Insert/update de tarefa com `statusId` verifica que o status pertence à mesma página da seção
  (senão `NOT_FOUND`). `withJson` sai (não há mais jsonb).
- `listTasksFn` retorna `status_id, note, created_at` (ISO string).

### Coleções (`src/data/source.ts`)

- Nova coleção `statuses` em `Source`, nos dois modos; nova `queryKeys.statuses`, incluída no prefetch
  do loader `/s/$slug`.

## 2. Regras checkbox ↔ status (`src/data/actions.ts`)

Toda mudança de status/`done` de uma tarefa é **uma** `tasks.update` com os dois campos juntos.

| Ação | Efeito |
|---|---|
| Marca checkbox | `done=true`; `statusId = firstDone(page)?.id` (se não existir, só marca) |
| Desmarca | `done=false`; se status atual tem `done`, `statusId = firstOpen(page)?.id` |
| Muda status (select, menu, DnD) | `statusId = s.id`; `done = s.done` |
| Liga/desliga `done` de um status | `statuses.update` + `tasks.update` em lote das tarefas da coluna (`done` = novo valor) |
| Deleta status | `confirm("Mover N tarefas para <vizinho>?")`; tarefas vão para o status vizinho (anterior, ou próximo se for o primeiro) em lote com `done` ajustado; depois `statuses.delete`. Botão desabilitado quando é o único status. |
| Cria página | `addPage` insere também os 3 `DEFAULT_STATUSES` |
| Deleta página | remove também os status da página (local não tem cascade) |
| Página local antiga sem status | `ensureStatuses(pageId)` ao abrir a página no modo local insere os padrões (sem concorrência no localStorage) |

Novas ações: `addStatus`, `updateStatus`, `deleteStatus`, `setTaskStatus`, `setTaskDone`,
`reorder(collection, orderedIds, extraChanges?)`.

## 3. Reordenação (DnD) — modelo

`position` continua `int`. Ao soltar, calcula-se a lista final de ids do container de destino (e de
origem, se diferente) e grava-se só quem mudou numa **única** `collection.update([...ids], drafts => …)`
= uma transação otimista, uma chamada ao servidor. Mover tarefa entre seções/colunas inclui
`sectionId`/`statusId`/`done` no mesmo draft.

Função pura `renumber(orderedIds, current: Map<id, position>) → Map<id, newPosition>` (só os alterados)
em `src/lib/order.ts`, coberta por teste.

Subir/Descer nos menus continuam como alternativa acessível (usam `renumber` também; `swap` sai).

## 4. Infra de DnD (`src/components/dnd.tsx`)

Wrapper fino sobre dnd-kit, compartilhado pelas 4 superfícies:

- Sensores: `PointerSensor` (mouse: `distance: 5`), `TouchSensor` (`delay: 200, tolerance: 6`),
  `KeyboardSensor` com `sortableKeyboardCoordinates`.
- `accessibility.announcements` e `screenReaderInstructions` em PT-BR
  ("Tarefa X levantada. Use as setas…", "Tarefa X movida para Em Andamento, posição 2 de 5").
- `DragOverlay` com sombra, `rotate(2deg) scale(1.03)`; item de origem vira placeholder tracejado
  (`opacity` + borda `dashed`). `prefers-reduced-motion`: sem rotação/escala, `dropAnimation: null`.
- Padrão multi-container: durante o arrasto um estado local `Record<containerId, id[]>` é mutado em
  `onDragOver` (preview ao vivo); em `onDragEnd` aplica-se a mutation otimista e o estado local é
  descartado — a live query já reflete a nova ordem, sem "pulo".
- `onDragCancel` (Esc) restaura.

## 5. Visão Lista

- **Chip de status** no lugar dos badges (visual do `BadgeChip`, renomeado para `StatusChip`), ao lado
  do texto. Clicar abre `Popover` com as opções da página (bolinha de cor, nome, ✓ na atual) e, ao fim,
  **"+ Novo status"** → `StatusEditor` (o `BadgeEditor` atual + checkbox "Conta como concluído").
- **Chip escondido** quando o status resolvido é o **primeiro** da página (A Fazer) ou quando a tarefa
  está `done` no `firstDone` — o checkbox riscado já comunica. Nesses casos troca-se pelo menu.
- **Menu da tarefa**: "Adicionar badge" → **"Status"** (abre a mesma lista de opções),
  **"Adicionar nota" / "Editar nota"**; Subir/Descer; Deletar.
- **Nota**: abaixo do texto, `text-[0.82rem] text-ink-soft`, `line-clamp-2` com clique para editar
  (padrão idêntico à nota de seção). Edição via `InlineEdit multiline` com **botão de microfone**.
- **DnD**: handle `GripVertical` à esquerda do checkbox (sempre visível em `pointer: coarse`, revelado
  em hover/focus no desktop — mesmo mecanismo `quiet` já usado no menu). Reordena tarefas e **move entre
  seções** (containers = seções). Seções reordenam pelo handle no cabeçalho do card da seção.

### Microfone na edição inline

`InlineEdit` ganha prop `voice?: string` (rótulo do botão). Quando presente, o campo em edição
renderiza `VoiceButton` ao lado; o botão usa `onPointerDown={e => e.preventDefault()}` para não roubar
o foco (senão o `blur` salva e fecha a edição). `VoiceButton` ganha prop `label` (hoje fixo em
"Ditar tarefa"). Usado na nota da tarefa (Lista), na descrição (modal) e no título (modal).

## 6. Visão Quadro (Kanban)

### Alternância e largura

- Search param validado nas rotas de página: `view: 'lista' | 'quadro'` (default `lista`) e
  `task?: string` (id da tarefa com modal aberto).
- **Segmented control** "Lista | Quadro" (`List`, `Columns3`) no header, acima do progresso;
  `role="radiogroup"` semântico via `<fieldset>` + radios estilizados.
- `Shell` lê `useSearch({ strict: false }).view` e troca `max-w-[720px]` por `max-w-none` quando
  `view === 'quadro'` (layouts `/s/$slug` e `/local` não mudam). No modo largo o header mantém padding
  lateral e o quadro usa `w-full`.

### Layout

- Linha horizontal de colunas com `overflow-x-auto`, `scroll-snap-type: x mandatory` em telas
  estreitas, `snap-start` em cada coluna; largura `w-[min(85vw,300px)]`. No desktop, colunas de 300px
  alinhadas à esquerda com gap 12px e scroll horizontal se não couberem.
- Altura: colunas ocupam a altura disponível (`h-[calc(100dvh-header)]`) com scroll vertical interno.

### Coluna

- Cabeçalho: bolinha de cor, nome (`InlineEdit`), contador, menu: Cor, "Conta como concluído" (toggle),
  Mover ←/→ (alternativa ao DnD), Deletar coluna. Arrastar o cabeçalho reordena colunas.
- Rodapé: **"+ Adicionar tarefa"** → input com microfone; se a página tiver >1 seção, `<select>` de
  seção ao lado (lembra a última escolhida por página em `localStorage`, try/catch). Enter cria a
  tarefa naquela coluna (`statusId`, `done` do status).
- No fim do quadro, coluna fantasma tracejada **"+ Nova coluna"** → `StatusEditor`.

### Card

- Checkbox (sincronizado), texto (`line-clamp-3`), rótulo da seção (só se houver >1 seção), ícone
  `StickyNote` se tiver nota, menu (Mover para → status…, Deletar).
- **Clique no card abre o modal** (checkbox e menu param a propagação). Arrastar a partir de 5px (mouse)
  ou long-press 200ms (touch) inicia DnD em vez do clique.
- Enter/Espaço no card focado abre o modal; espaço é interceptado pelo `KeyboardSensor` só quando o
  foco está no handle — no Quadro o card inteiro é o handle, então **Enter abre o modal e Espaço
  levanta para arrastar** (instrução anunciada ao leitor de tela).

### Página sem seções

Estado vazio: "Crie uma seção na Lista primeiro" + botão que troca para `view=lista`.

## 7. Modal de detalhes da tarefa (só no Quadro)

- `<dialog>` nativo com `showModal()` (focus trap, Esc, `::backdrop`, top layer). Estado dirigido pelo
  search param `task` → botão voltar do celular fecha o modal; link compartilhável.
- Desktop: centralizado, `max-w-lg`. Mobile (`max-width: 640px`): bottom sheet ocupando até `90dvh`,
  cantos superiores arredondados, animação slide-up (sem animação com reduced-motion).
- Conteúdo, em ordem:
  1. Cabeçalho: checkbox + **título** editável (`InlineEdit multiline`, com microfone), botão fechar (`X`).
  2. Metadados em linha: **status** (chip → mesmo popover de opções), **seção**, **"Criada em
     23 de set. de 2026 às 14:32"** (`Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })`,
     `<time dateTime>`; `title` com data relativa via `Intl.RelativeTimeFormat`). Oculto se `createdAt` null.
  3. **Descrição**: `<textarea>` sempre visível, `field-sizing-content`, min 4 linhas, placeholder
     "Adicione uma descrição…", microfone ao lado, salva em blur e ao fechar o modal; contador
     discreto só perto do limite (`> 1800/2000`).
  4. Rodapé: "Deletar tarefa" (danger; fecha o modal e mostra o toast com Desfazer existente).
- Tarefa deletada em outro aparelho com o modal aberto: fecha e limpa o search param.

## 8. Lista de páginas

`PagesView` ganha handle + sortable vertical, com a mesma infra. Subir/Descer permanecem no menu.

## 9. Otimismo e erros

- Todas as mutations passam por `run()` existente (rollback automático do TanStack DB + toast
  "Não salvou · Tentar de novo"). Reordenações e mudanças de status são uma transação cada.
- Inserção de status padrão junto com a página: duas transações (pages, statuses); se a de statuses
  falhar, o retry do toast refaz; e a Lista funciona sem status (fallback), então não há estado quebrado.

## 10. Testes e validação

- **Unit** (`node --test`, sem framework novo; TS via `--experimental-strip-types`):
  `src/lib/order.test.ts` (renumber), `src/lib/status.test.ts` (fallback, firstDone/firstOpen, regras
  de checkbox como funções puras).
- **Typecheck + build** (`npm run typecheck`, `npm run build`).
- **E2E manual via Playwright MCP** em desktop e viewport 390×844, modo sessão e local:
  migração de uma sessão existente; arrastar card entre colunas e dentro; reordenar colunas; mover
  tarefa entre seções na Lista; reordenar seções e páginas; checkbox ↔ coluna; deletar coluna com
  tarefas; criar status novo pela Lista; nota com ditado (verificar que o foco não sai); modal abre por
  clique/Enter, fecha por Esc/voltar/backdrop; F5 persiste tudo; DnD por teclado.
- **Skills**: `web-design-guidelines` (UX/a11y) e `react-doctor` ao final, aplicando correções.

## Fora de escopo (YAGNI)

- Swimlanes por seção no Quadro, filtros, múltiplas tags por tarefa.
- Lembrar a última visão (Lista/Quadro) por página — o search param basta; adicionar se incomodar.
- Tempo real (websocket) — segue o polling de 15s existente.
- Data de criação nas tarefas antigas (ficam sem data).

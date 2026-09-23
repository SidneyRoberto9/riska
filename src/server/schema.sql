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
  position   int NOT NULL
);
CREATE INDEX IF NOT EXISTS pages_session_idx ON pages (session_slug);
CREATE INDEX IF NOT EXISTS sections_page_idx ON sections (page_id);
CREATE INDEX IF NOT EXISTS tasks_section_idx ON tasks (section_id);

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

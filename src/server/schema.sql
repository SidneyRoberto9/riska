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

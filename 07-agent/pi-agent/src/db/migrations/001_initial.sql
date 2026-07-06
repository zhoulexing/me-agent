PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS agent_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL,
  thread_id TEXT NOT NULL DEFAULT '',
  agent_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_reply_to TEXT,
  last_sender_id TEXT,
  last_sender_name TEXT,
  last_is_private INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_key, thread_id)
);

CREATE TABLE IF NOT EXISTS channel_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES agent_sessions(id),
  message_uid TEXT,
  source TEXT NOT NULL,
  direction TEXT NOT NULL,
  content TEXT NOT NULL,
  sender_id TEXT,
  sender_name TEXT,
  reply_to TEXT,
  channel_payload TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(message_uid)
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES agent_sessions(id),
  input_message_id INTEGER REFERENCES channel_messages(id),
  status TEXT NOT NULL,
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES agent_runs(id),
  event_type TEXT NOT NULL,
  content TEXT,
  event_payload TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL,
  thread_id TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  cron TEXT,
  run_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sdk_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER REFERENCES agent_runs(id),
  session_id INTEGER REFERENCES agent_sessions(id),
  level TEXT NOT NULL,
  event_name TEXT NOT NULL,
  sdk_payload TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_route ON agent_sessions(session_key);
CREATE INDEX IF NOT EXISTS idx_channel_messages_session_created ON channel_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_session_started ON agent_runs(session_id, started_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(enabled, next_run_at);

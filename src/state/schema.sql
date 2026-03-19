-- Masaad AI D1 Schema

-- Agent state persistence
CREATE TABLE IF NOT EXISTS agent_state (
  role TEXT PRIMARY KEY,
  current_goals TEXT NOT NULL DEFAULT '[]',
  completed TEXT NOT NULL DEFAULT '[]',
  pending_tags TEXT NOT NULL DEFAULT '[]',
  last_active TEXT NOT NULL DEFAULT '',
  cycle_count INTEGER NOT NULL DEFAULT 0,
  weekly_messages_sent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Message history (for context windows)
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_type TEXT NOT NULL CHECK(group_type IN ('hq', 'showcase', 'dev')),
  sender_role TEXT NOT NULL,
  content TEXT NOT NULL,
  message_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cross-agent task handoffs
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_role TEXT NOT NULL,
  to_role TEXT NOT NULL,
  task TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Email drafts awaiting approval
CREATE TABLE IF NOT EXISTS email_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_role TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'sent')),
  telegram_message_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  acted_at TEXT
);

-- Health check log
CREATE TABLE IF NOT EXISTS health_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ok', 'warn', 'fail')),
  details TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Global flags (kill switch, etc)
CREATE TABLE IF NOT EXISTS flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Initialize kill switch as active (running)
INSERT OR IGNORE INTO flags (key, value) VALUES ('shutdown', 'false');

-- Initialize agent states
INSERT OR IGNORE INTO agent_state (role) VALUES ('ceo');
INSERT OR IGNORE INTO agent_state (role) VALUES ('sales');
INSERT OR IGNORE INTO agent_state (role) VALUES ('marketing');
INSERT OR IGNORE INTO agent_state (role) VALUES ('cto');
INSERT OR IGNORE INTO agent_state (role) VALUES ('finance');
INSERT OR IGNORE INTO agent_state (role) VALUES ('ir');
INSERT OR IGNORE INTO agent_state (role) VALUES ('devops');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_to_role ON tasks(to_role, status);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON email_drafts(status);

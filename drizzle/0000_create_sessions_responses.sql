CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_code CHAR(4) NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drizzle.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES drizzle.sessions(session_id),
  submitted_at TIMESTAMPTZ,
  answers JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_pin_code_idx ON drizzle.sessions (pin_code) WHERE status = 'active';

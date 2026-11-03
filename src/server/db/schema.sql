CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL, password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (
  id bigserial PRIMARY KEY, email text NOT NULL, ok boolean NOT NULL, at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS companies (
  id text PRIMARY KEY, name text NOT NULL, profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan text NOT NULL DEFAULT 'prueba', monthly_budget_usd numeric NOT NULL DEFAULT 10,
  max_runs_per_hour int NOT NULL DEFAULT 30, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS memberships (
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  PRIMARY KEY (company_id, user_id));
CREATE TABLE IF NOT EXISTS departments (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key text NOT NULL, name text NOT NULL, custom boolean NOT NULL DEFAULT false,
  UNIQUE (company_id, key));
CREATE TABLE IF NOT EXISTS employees (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id text NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  template_key text, name text NOT NULL, role_title text NOT NULL, description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','inactive')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_output_tokens int NOT NULL DEFAULT 2000, max_runs_per_day int NOT NULL DEFAULT 20,
  current_skill_version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS skill_versions (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  version int NOT NULL, spec jsonb NOT NULL, note text NOT NULL DEFAULT '', author text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (employee_id, version));
CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  parent_task_id text REFERENCES tasks(id) ON DELETE SET NULL, root_task_id text,
  title text NOT NULL, instruction text NOT NULL, context text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','in_progress','completed','failed','awaiting_approval','rejected')),
  result text, error text, fingerprint text NOT NULL, depth int NOT NULL DEFAULT 0,
  skill_version int, input_tokens int NOT NULL DEFAULT 0, output_tokens int NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0, created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz);
CREATE INDEX IF NOT EXISTS tasks_company_idx ON tasks(company_id, created_at DESC);
CREATE TABLE IF NOT EXISTS task_events (
  id bigserial PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS approvals (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, employee_id text NOT NULL,
  toolkit text NOT NULL, action text NOT NULL, args jsonb NOT NULL DEFAULT '{}'::jsonb, summary text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by text, decided_at timestamptz, evidence jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS connections (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  toolkit text NOT NULL, status text NOT NULL, account_label text, scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  secret_enc text, external_id text, last_sync timestamptz, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (company_id, toolkit));
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL, kind text NOT NULL DEFAULT 'documento', content text NOT NULL,
  allowed_employee_ids jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS automations (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL, trigger jsonb NOT NULL, conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  employee_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE, instruction text NOT NULL,
  enabled boolean NOT NULL DEFAULT true, max_runs_per_day int NOT NULL DEFAULT 5, max_retries int NOT NULL DEFAULT 1,
  next_run_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS automation_runs (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  automation_id text NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  status text NOT NULL, task_id text, attempt int NOT NULL DEFAULT 1, error text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS usage_events (
  id bigserial PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id text, task_id text, input_tokens int NOT NULL, output_tokens int NOT NULL,
  cost_usd numeric NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY, company_id text, actor_user_id text, action text NOT NULL, target text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());

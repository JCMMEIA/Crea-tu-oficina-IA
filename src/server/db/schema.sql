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

-- === Capa Agencia (marca blanca) ===
CREATE TABLE IF NOT EXISTS agencies (
  id text PRIMARY KEY, name text NOT NULL, specialty text NOT NULL DEFAULT '',
  brand jsonb NOT NULL DEFAULT '{}'::jsonb, plan text NOT NULL DEFAULT 'prueba',
  monthly_budget_usd numeric NOT NULL DEFAULT 20,
  billing_status text NOT NULL DEFAULT 'sin_facturacion', external_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE companies ADD COLUMN IF NOT EXISTS agency_id text REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS companies_agency_idx ON companies(agency_id);
CREATE TABLE IF NOT EXISTS agency_members (
  agency_id text NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('agency_owner','agency_admin','agency_member')),
  PRIMARY KEY (agency_id, user_id));
CREATE TABLE IF NOT EXISTS agency_skill_templates (
  agency_id text NOT NULL REFERENCES agencies(id) ON DELETE CASCADE, template_key text NOT NULL,
  spec jsonb NOT NULL, note text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, template_key));
CREATE TABLE IF NOT EXISTS agency_services (
  id text PRIMARY KEY, agency_id text NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL, description text NOT NULL DEFAULT '', industry text NOT NULL DEFAULT '',
  template_keys jsonb NOT NULL DEFAULT '[]'::jsonb, price_usd numeric NOT NULL DEFAULT 0,
  price_unit text NOT NULL DEFAULT 'mes' CHECK (price_unit IN ('mes','proyecto')),
  est_tasks_per_month int NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','publicado')),
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS client_services (
  id text PRIMARY KEY, agency_id text NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_id text NOT NULL REFERENCES agency_services(id) ON DELETE CASCADE,
  employee_ids jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, service_id));
CREATE TABLE IF NOT EXISTS proposals (
  id text PRIMARY KEY, agency_id text NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  company_id text REFERENCES companies(id) ON DELETE SET NULL, client_name text NOT NULL, title text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb, notes text NOT NULL DEFAULT '', total_usd numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','enviada','aceptada','rechazada')),
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL DEFAULT '', stage text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '', consent boolean NOT NULL, utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now());

-- Migración idempotente del MVP: cada empresa sin agencia recibe una propia; sus propietarios la dirigen.
INSERT INTO agencies(id,name) SELECT 'ag-'||id, name FROM companies WHERE agency_id IS NULL ON CONFLICT DO NOTHING;
UPDATE companies SET agency_id='ag-'||id WHERE agency_id IS NULL;
INSERT INTO agency_members(agency_id,user_id,role)
  SELECT c.agency_id, m.user_id, 'agency_owner' FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.role='owner'
  ON CONFLICT DO NOTHING;

-- === Mensajería (WhatsApp / Telegram) ===
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS messaging jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '72 hours');
CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY, kind text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  attempts int NOT NULL DEFAULT 0, max_attempts int NOT NULL DEFAULT 3, run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz, last_error text, dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz);
CREATE INDEX IF NOT EXISTS jobs_due_idx ON jobs(status, run_at);
CREATE TABLE IF NOT EXISTS channel_identities (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('telegram','whatsapp')), external_id text NOT NULL, display text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  active_company_id text, state jsonb NOT NULL DEFAULT '{}'::jsonb,
  prefs jsonb NOT NULL DEFAULT '{"task_done":true,"errors":true,"approvals":true,"alerts":true,"digest":"off"}'::jsonb,
  consent_at timestamptz, last_inbound_at timestamptz, revoked_at timestamptz, revoked_by text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS channel_identity_active_uq ON channel_identities(channel, external_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS link_codes (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, channel text NOT NULL,
  code_hash text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz, consent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS link_codes_hash_idx ON link_codes(code_hash);
CREATE TABLE IF NOT EXISTS link_attempts (
  id bigserial PRIMARY KEY, channel text NOT NULL, external_id text NOT NULL, ok boolean NOT NULL, at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS channel_messages (
  id bigserial PRIMARY KEY, channel text NOT NULL, direction text NOT NULL CHECK (direction IN ('in','out')),
  external_msg_id text NOT NULL, identity_id text, user_id text, company_id text, agency_id text,
  external_id text, kind text NOT NULL DEFAULT 'text', text text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'received',
  task_id text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (channel, direction, external_msg_id));
CREATE TABLE IF NOT EXISTS channel_tasks (
  task_id text PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE, identity_id text NOT NULL, user_id text NOT NULL,
  company_id text NOT NULL, agency_id text, channel text NOT NULL, inbound_msg_id text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS approval_tokens (
  id text PRIMARY KEY, approval_id text NOT NULL REFERENCES approvals(id) ON DELETE CASCADE, identity_id text NOT NULL,
  company_id text NOT NULL, token_hash text NOT NULL, stage int NOT NULL DEFAULT 0, high_risk boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (approval_id, identity_id));
CREATE TABLE IF NOT EXISTS outbox (
  id text PRIMARY KEY, identity_id text, to_external text, channel text NOT NULL, kind text NOT NULL, text text NOT NULL,
  dedupe_key text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts int NOT NULL DEFAULT 0, last_error text, external_msg_id text, in_reply_to text,
  created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz);
CREATE TABLE IF NOT EXISTS agency_channel_credentials (
  agency_id text NOT NULL REFERENCES agencies(id) ON DELETE CASCADE, channel text NOT NULL, secret_enc text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (agency_id, channel));

-- === Rediseño de experiencia ===
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS onboarding jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- === Piloto: inventario y borradores de resurtido ===
CREATE TABLE IF NOT EXISTS inventory_items (
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE, sku text NOT NULL, name text NOT NULL,
  stock int NOT NULL CHECK (stock >= 0), min_stock int NOT NULL CHECK (min_stock >= 0), max_stock int NOT NULL CHECK (max_stock >= 0),
  unit_cost numeric NOT NULL DEFAULT 0, supplier text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, sku), CHECK (min_stock <= max_stock));
CREATE TABLE IF NOT EXISTS restock_drafts (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE, task_id text,
  items jsonb NOT NULL, total_units int NOT NULL, total_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','aprobado_sin_enviar','rechazado')),
  created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz);

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

-- === Sistema comercial: embudo, seguimiento, licencias, soporte, medición ===
ALTER TABLE leads ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'acceso';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'nuevo';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS interests jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_time text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'directo';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS landing text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS demo_requested_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_followup_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_note text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status, created_at);
CREATE TABLE IF NOT EXISTS lead_notes (
  id text PRIMARY KEY, lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE, body text NOT NULL,
  author_user_id text, created_at timestamptz NOT NULL DEFAULT now());
-- Medición propia (sin cookies ni IP): solo nombre de evento, ruta, fuente y propiedades acotadas.
CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY, name text NOT NULL, path text NOT NULL DEFAULT '', source text NOT NULL DEFAULT 'directo',
  props jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS events_name_idx ON events(name, created_at);
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS signup_source text NOT NULL DEFAULT 'directo';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plan_interest text NOT NULL DEFAULT '';
-- Licencias: el plan efectivo vive en agencies.plan; esta tabla es el historial (quién, cuándo, de dónde vino).
CREATE TABLE IF NOT EXISTS licenses (
  id text PRIMARY KEY, agency_id text NOT NULL REFERENCES agencies(id) ON DELETE CASCADE, plan text NOT NULL,
  status text NOT NULL CHECK (status IN ('activa','cancelada','vencida')),
  origin text NOT NULL CHECK (origin IN ('manual','pasarela')), starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
  note text NOT NULL DEFAULT '', created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS licenses_agency_idx ON licenses(agency_id, created_at);
CREATE TABLE IF NOT EXISTS plan_requests (
  id text PRIMARY KEY, agency_id text NOT NULL REFERENCES agencies(id) ON DELETE CASCADE, user_id text, plan text NOT NULL,
  status text NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada','atendida','descartada')),
  note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS support_requests (
  id text PRIMARY KEY, agency_id text, user_id text, email text NOT NULL, subject text NOT NULL, body text NOT NULL,
  status text NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta','resuelta')), created_at timestamptz NOT NULL DEFAULT now());
-- Eventos de pago ya procesados (idempotencia de webhooks).
CREATE TABLE IF NOT EXISTS payment_events (external_id text PRIMARY KEY, agency_id text NOT NULL, type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());

-- === Modelo de compra directa (LANDING → PAGO → OFICINA AUTOMÁTICA) y múltiples oficinas por cuenta ===
-- «Oficina IA» = una agencia (inquilino). Una cuenta puede ser miembro de varias; cada una tiene sus propios datos, plan, suscripción y límites.
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'activa';       -- activa | pausada | cancelada
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT '';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
-- Intención de compra: se crea ANTES de pagar (sin cuenta ni agencia). Guarda quién compra y qué configuró; NO da acceso a nada.
CREATE TABLE IF NOT EXISTS checkout_intents (
  id text PRIMARY KEY, email text, user_id text REFERENCES users(id) ON DELETE SET NULL, kind text NOT NULL DEFAULT 'primera' CHECK (kind IN ('primera','adicional')),
  plan text NOT NULL, config jsonb NOT NULL DEFAULT '{}'::jsonb, source text NOT NULL DEFAULT 'directo', utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  checkout_session_id text UNIQUE, checkout_url text, created_at timestamptz NOT NULL DEFAULT now());
-- Pedido = pago confirmado por webhook firmado. La clave única del session_id impide duplicados aunque Stripe reenvíe o lleguen eventos en paralelo.
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY, checkout_session_id text NOT NULL UNIQUE, intent_id text, email text NOT NULL, user_id text REFERENCES users(id) ON DELETE SET NULL,
  plan text NOT NULL, kind text NOT NULL DEFAULT 'primera', status text NOT NULL DEFAULT 'pagada' CHECK (status IN ('pagada','entregada','error')),
  stripe_customer_id text, stripe_subscription_id text, amount_total bigint, currency text, source text NOT NULL DEFAULT 'directo',
  agency_id text REFERENCES agencies(id) ON DELETE SET NULL, last_error text, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz);
-- Derecho de crear UNA oficina. Nace de un pago (source='pago') o de una cortesía del operador. Es la ÚNICA vía para crear oficinas de compradores.
CREATE TABLE IF NOT EXISTS office_rights (
  id text PRIMARY KEY, user_id text REFERENCES users(id) ON DELETE CASCADE, email text NOT NULL, plan text NOT NULL, source text NOT NULL CHECK (source IN ('pago','cortesia')),
  order_id text UNIQUE, agency_id text REFERENCES agencies(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), used_at timestamptz);
CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY, agency_id text REFERENCES agencies(id) ON DELETE SET NULL, customer_id text, status text NOT NULL DEFAULT 'active',
  cancel_at_period_end boolean NOT NULL DEFAULT false, current_period_end timestamptz, last_event_created bigint NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS invoices (
  id text PRIMARY KEY, subscription_id text, agency_id text REFERENCES agencies(id) ON DELETE SET NULL, amount_paid bigint NOT NULL DEFAULT 0, currency text,
  status text NOT NULL DEFAULT 'paid', hosted_invoice_url text, period_end timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS invoices_sub_idx ON invoices(subscription_id);
-- Enlaces de acceso de un solo uso (sustituyen al registro y a la contraseña olvidada). Solo se guarda el hash.
CREATE TABLE IF NOT EXISTS access_links (
  token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose text NOT NULL DEFAULT 'acceso',
  expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS access_links_user_idx ON access_links(user_id, created_at);
-- Cola de correos transaccionales. El enlace de acceso se genera AL ENVIAR (no se guarda en claro).
CREATE TABLE IF NOT EXISTS emails (
  id text PRIMARY KEY, to_email text NOT NULL, kind text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'en_cola' CHECK (status IN ('en_cola','enviado','error')),
  attempts int NOT NULL DEFAULT 0, retry_at timestamptz NOT NULL DEFAULT now(), last_error text, dedupe_key text UNIQUE, provider_id text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz);
CREATE TABLE IF NOT EXISTS system_checks (name text PRIMARY KEY, ok boolean NOT NULL, detail text NOT NULL DEFAULT '', checked_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS ad_spend (id text PRIMARY KEY, day date NOT NULL, source text NOT NULL DEFAULT 'meta', amount_mxn numeric NOT NULL CHECK (amount_mxn >= 0), note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());

-- === Correos: estado de entrega real (webhook del proveedor), diagnóstico y reintentos manuales controlados ===
ALTER TABLE emails ADD COLUMN IF NOT EXISTS provider_status int;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS delivery_status text;       -- sent | delivered | delivery_delayed | bounced | complained (según el proveedor)
ALTER TABLE emails ADD COLUMN IF NOT EXISTS delivery_at timestamptz;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS delivery_detail text;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS manual_retries int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS emails_provider_idx ON emails(provider_id);
CREATE INDEX IF NOT EXISTS emails_status_idx ON emails(status, created_at);
-- Identidad de empleados: foto personalizada del cliente (imagen pequeña validada, data URL). El nombre propio usa employees.name.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo text;
-- Tareas guiadas: cada ejecución y su resultado, ligados a la oficina (company_id) y a la tarea del motor (tasks). El resultado SIEMPRE es una propuesta generada: no implica publicación ni envío.
CREATE TABLE IF NOT EXISTS guided_runs (
  id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id text REFERENCES employees(id) ON DELETE SET NULL, task_id text REFERENCES tasks(id) ON DELETE SET NULL,
  task_key text NOT NULL, title text NOT NULL, answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'en_proceso' CHECK (status IN ('en_proceso','listo','error')),
  result text, result_edited text, edited_at timestamptz, error text, error_code text,
  sections_ok boolean, sections_missing jsonb, context_used jsonb,
  input_tokens int NOT NULL DEFAULT 0, output_tokens int NOT NULL DEFAULT 0, cost_usd numeric NOT NULL DEFAULT 0,
  created_by text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS guided_runs_company_idx ON guided_runs(company_id, created_at DESC);

-- ===== Router de modelos de IA, cuotas y registro de llamadas =====
-- Catálogo de modelos EDITABLE desde /admin/ia. Un modelo solo se usa si enabled Y verified (precio y política de datos revisados por una persona). No hay precios «de fábrica».
CREATE TABLE IF NOT EXISTS ai_models (
  id text PRIMARY KEY, provider text NOT NULL CHECK (provider IN ('openrouter','anthropic')), model_id text NOT NULL, label text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('free','economy','premium')), max_level text NOT NULL DEFAULT 'B' CHECK (max_level IN ('A','B','C')),
  price_in_usd_mtok numeric NOT NULL DEFAULT 0, price_out_usd_mtok numeric NOT NULL DEFAULT 0, context_window int NOT NULL DEFAULT 8000,
  supports_tools boolean NOT NULL DEFAULT false, supports_json boolean NOT NULL DEFAULT false,
  data_policy text NOT NULL DEFAULT 'unknown' CHECK (data_policy IN ('unknown','may_train','no_training','zero_retention')),
  credit_weight numeric NOT NULL DEFAULT 1, enabled boolean NOT NULL DEFAULT false, verified boolean NOT NULL DEFAULT false, notes text NOT NULL DEFAULT '',
  updated_by text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (provider, model_id));
CREATE TABLE IF NOT EXISTS ai_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_by text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now());
-- Límites por plan (internos; NO son precios publicados). Cuota mensual en CRÉDITOS (= tokens × peso del modelo) y tope interno de gasto en USD por CUENTA.
CREATE TABLE IF NOT EXISTS ai_plan_limits (
  plan text PRIMARY KEY, monthly_credits bigint NOT NULL, monthly_budget_usd numeric NOT NULL, max_offices int NOT NULL DEFAULT 1,
  allowed_tiers text[] NOT NULL DEFAULT ARRAY['free','economy']::text[], max_level text NOT NULL DEFAULT 'B' CHECK (max_level IN ('A','B','C')),
  max_task_usd numeric NOT NULL DEFAULT 0.25, updated_by text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now());
-- Uso del mes por cuenta (dueño de la oficina). Reservas y consumo viven en la MISMA fila para poder reservar con una sola sentencia atómica.
CREATE TABLE IF NOT EXISTS ai_accounts (
  account_id text NOT NULL, period date NOT NULL, credits_used bigint NOT NULL DEFAULT 0, credits_reserved bigint NOT NULL DEFAULT 0,
  usd_used numeric NOT NULL DEFAULT 0, usd_reserved numeric NOT NULL DEFAULT 0, tokens_used bigint NOT NULL DEFAULT 0, calls int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (account_id, period));
CREATE TABLE IF NOT EXISTS ai_reservations (
  id text PRIMARY KEY, account_id text NOT NULL, period date NOT NULL, company_id text, task_id text, credits bigint NOT NULL, usd numeric NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','settled','released')), created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz);
CREATE INDEX IF NOT EXISTS ai_reservations_open_idx ON ai_reservations(status, created_at);
-- Una fila por INTENTO de llamada a un modelo (incluye los que fallan): auditoría de costo, fallback y calidad.
CREATE TABLE IF NOT EXISTS ai_calls (
  id bigserial PRIMARY KEY, account_id text NOT NULL, company_id text, task_id text, employee_id text, attempt int NOT NULL DEFAULT 1,
  level text, sensitivity text, requested_model text, used_model text, provider text, status text NOT NULL, fallback_reason text,
  input_tokens int NOT NULL DEFAULT 0, output_tokens int NOT NULL DEFAULT 0, credits bigint NOT NULL DEFAULT 0, cost_usd numeric NOT NULL DEFAULT 0, cost_source text NOT NULL DEFAULT 'estimado',
  latency_ms int NOT NULL DEFAULT 0, validation jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ai_calls_account_idx ON ai_calls(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_calls_task_idx ON ai_calls(task_id);
CREATE TABLE IF NOT EXISTS ai_alerts (account_id text NOT NULL, period date NOT NULL, threshold int NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (account_id, period, threshold));

-- ===== Programa de afiliados (por invitación o solicitud aprobada) =====
ALTER TABLE checkout_intents ADD COLUMN IF NOT EXISTS affiliate_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_flag text;
CREATE TABLE IF NOT EXISTS affiliates (
  id text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL DEFAULT '', code text UNIQUE, status text NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada','aprobada','suspendida','rechazada')),
  channel text NOT NULL DEFAULT '', terms_version text, terms_accepted_at timestamptz, invited boolean NOT NULL DEFAULT false, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz);
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id text PRIMARY KEY, affiliate_id text NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE, period date NOT NULL, total_cents bigint NOT NULL, currency text NOT NULL DEFAULT 'mxn',
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','pagado')), reference text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz, UNIQUE (affiliate_id, period));
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id text PRIMARY KEY, affiliate_id text NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE, order_id text, invoice_id text, month_index int NOT NULL DEFAULT 1,
  net_cents bigint NOT NULL, rate numeric NOT NULL, amount_cents bigint NOT NULL, currency text NOT NULL DEFAULT 'mxn',
  kind text NOT NULL DEFAULT 'comision' CHECK (kind IN ('comision','ajuste')), status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','aprobada','pagada','revertida')),
  reason text NOT NULL DEFAULT '', payout_id text REFERENCES affiliate_payouts(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_commissions_invoice_idx ON affiliate_commissions(invoice_id, kind) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS affiliate_commissions_aff_idx ON affiliate_commissions(affiliate_id, created_at DESC);

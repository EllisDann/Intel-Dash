-- Add tenant trial metadata, integration tables, and security indexes

ALTER TABLE tenants
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN trial_start_date TIMESTAMPTZ NULL,
  ADD COLUMN trial_end_date TIMESTAMPTZ NULL,
  ADD COLUMN is_trial_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'trial';

ALTER TABLE users
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS users_tenant_email_idx ON users (tenant_id, email);

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  connected_at TIMESTAMPTZ NULL,
  disconnected_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL,
  encrypted_credential TEXT NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  state TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create work_items table for imported projects and tasks

CREATE TABLE IF NOT EXISTS work_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  state TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS work_items_tenant_idx ON work_items (tenant_id);
CREATE INDEX IF NOT EXISTS work_items_source_idx ON work_items (tenant_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS work_items_state_idx ON work_items (tenant_id, state);

-- Add return_url column to oauth_states if it doesn't exist
ALTER TABLE oauth_states
  ADD COLUMN IF NOT EXISTS return_url TEXT NULL;

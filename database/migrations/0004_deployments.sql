-- 0004_deployments.sql
-- Add deployment tracking for GitHub Deployments API

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'github',
  source_id TEXT NOT NULL,
  environment TEXT,
  ref TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deployed_at TIMESTAMP WITH TIME ZONE,
  external_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  indexed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployments_tenant_date ON deployments (tenant_id, deployed_at);
CREATE INDEX IF NOT EXISTS idx_deployments_source ON deployments (tenant_id, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deployments_external_id ON deployments (tenant_id, source_id, external_id);

CREATE TABLE IF NOT EXISTS deployment_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deployment_id UUID NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  environment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployment_statuses_deployment ON deployment_statuses (deployment_id);

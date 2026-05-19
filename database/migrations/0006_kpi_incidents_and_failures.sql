-- 0006_kpi_incidents_and_failures.sql
-- Add incident tracking for Change Failure Rate and MTTR metrics

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  jira_key TEXT,
  external_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT, -- 'critical', 'high', 'medium', 'low'
  environment TEXT, -- 'production', 'staging', 'development'
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
  created_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  resolved_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  indexed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_tenant_created ON incidents (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_resolved ON incidents (tenant_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents (tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_environment ON incidents (tenant_id, environment);
CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_external_id ON incidents (tenant_id, jira_key);

-- Link incidents to deployments for Change Failure Rate calculation
CREATE TABLE IF NOT EXISTS incident_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  time_to_incident_hours NUMERIC, -- Time from deployment to incident creation
  linked_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_deployments_incident ON incident_deployments (incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_deployments_deployment ON incident_deployments (deployment_id);
CREATE INDEX IF NOT EXISTS idx_incident_deployments_tenant ON incident_deployments (tenant_id);

-- Track reverts and hotfixes as deployment failures
CREATE TABLE IF NOT EXISTS failed_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  failure_type TEXT NOT NULL, -- 'incident', 'revert', 'hotfix', 'ci_failure'
  reason TEXT,
  discovered_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  incident_id UUID REFERENCES incidents(id),
  revert_pr_id UUID REFERENCES pull_requests(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_failed_deployments_tenant_date ON failed_deployments (tenant_id, discovered_at);
CREATE INDEX IF NOT EXISTS idx_failed_deployments_deployment ON failed_deployments (deployment_id);
CREATE INDEX IF NOT EXISTS idx_failed_deployments_incident ON failed_deployments (incident_id);

-- Aggregate failure metrics for dashboard
CREATE TABLE IF NOT EXISTS deployment_failure_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_deployments INTEGER NOT NULL DEFAULT 0,
  failed_deployments INTEGER NOT NULL DEFAULT 0,
  incidents_count INTEGER NOT NULL DEFAULT 0,
  critical_incidents INTEGER NOT NULL DEFAULT 0,
  avg_mttr_hours NUMERIC, -- Average time to restore for the day
  change_failure_rate NUMERIC, -- Percentage
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployment_failure_metrics_tenant_date ON deployment_failure_metrics (tenant_id, snapshot_date);

-- MTTR aggregates
CREATE TABLE IF NOT EXISTS mttr_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  mttr_hours NUMERIC NOT NULL, -- Time to resolve
  severity TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mttr_metrics_tenant_incident ON mttr_metrics (tenant_id, incident_id);
CREATE INDEX IF NOT EXISTS idx_mttr_metrics_tenant_date ON mttr_metrics (tenant_id, created_at);

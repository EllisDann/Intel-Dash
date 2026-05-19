-- 0003_metric_snapshots_and_adoption.sql
-- Adds metric snapshots/aggregates and AI adoption marker tables

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  metric_type TEXT NOT NULL,
  period TEXT NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metric_snapshots_tenant_date ON metric_snapshots (tenant_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_type_date ON metric_snapshots (tenant_id, metric_type, snapshot_date);

CREATE TABLE IF NOT EXISTS metric_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL,
  throughput NUMERIC,
  avg_cycle_time NUMERIC,
  avg_lead_time NUMERIC,
  total_developers INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metric_aggregates_tenant_period ON metric_aggregates (tenant_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS ai_adoption_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  adoption_date DATE NOT NULL,
  label TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_adoption_tenant ON ai_adoption_dates (tenant_id);

-- Optional: work item metrics table to store per-item cycle/lead times
CREATE TABLE IF NOT EXISTS work_item_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  work_item_id UUID NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  cycle_time_hours NUMERIC,
  lead_time_hours NUMERIC,
  throughput_value INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_item_metrics_tenant_completed ON work_item_metrics (tenant_id, completed_at);

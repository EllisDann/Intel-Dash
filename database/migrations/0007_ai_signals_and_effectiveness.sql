-- 0007_ai_signals_and_effectiveness.sql
-- Add AI signals tracking for AI Effectiveness KPIs

CREATE TABLE IF NOT EXISTS ai_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- 'commit_message', 'pr_description', 'pr_label', 'copilot_telemetry'
  signal_type TEXT NOT NULL, -- 'ai_tag', 'copilot_mention', 'ai_label', 'ai_generated_code'
  pull_request_id UUID REFERENCES pull_requests(id) ON DELETE SET NULL,
  commit_hash TEXT,
  repository_name TEXT,
  confidence_score NUMERIC DEFAULT 0.5, -- 0-1, how confident we are this is AI-generated
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_signals_tenant_date ON ai_signals (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_signals_pr ON ai_signals (pull_request_id);
CREATE INDEX IF NOT EXISTS idx_ai_signals_source_type ON ai_signals (tenant_id, source_type);

-- Enhanced metric snapshots for AI effectiveness
-- Stores: AI-assisted PR rate, review efficiency, velocity comparisons
CREATE TABLE IF NOT EXISTS ai_effectiveness_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  ai_assisted_pr_count INTEGER NOT NULL DEFAULT 0,
  total_pr_count INTEGER NOT NULL DEFAULT 0,
  ai_assisted_rate NUMERIC, -- Percentage
  ai_assisted_pr_avg_cycle_time_hours NUMERIC,
  non_ai_pr_avg_cycle_time_hours NUMERIC,
  ai_pr_acceptance_rate NUMERIC, -- % merged without reverts
  avg_review_time_ai_prs_hours NUMERIC,
  avg_review_time_non_ai_prs_hours NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_effectiveness_metrics_tenant_date ON ai_effectiveness_metrics (tenant_id, snapshot_date);

-- AI Velocity Gain calculations (comparison pre/post adoption)
CREATE TABLE IF NOT EXISTS ai_velocity_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  period_days INTEGER, -- 30, 60, or 90 day period
  pre_adoption_date DATE NOT NULL, -- Start of pre period
  post_adoption_date DATE NOT NULL, -- Start of post period
  -- Tier 1 metrics
  lead_time_improvement_percent NUMERIC,
  deployment_frequency_improvement_percent NUMERIC,
  pr_cycle_time_improvement_percent NUMERIC,
  change_failure_rate_improvement_percent NUMERIC,
  -- Aggregate score
  overall_velocity_gain_percent NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_velocity_comparisons_tenant_date ON ai_velocity_comparisons (tenant_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_ai_velocity_comparisons_period ON ai_velocity_comparisons (tenant_id, period_days);

-- Review efficiency details
CREATE TABLE IF NOT EXISTS review_efficiency_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  reviewer_name TEXT,
  first_review_requested_at TIMESTAMPTZ,
  first_review_submitted_at TIMESTAMPTZ,
  last_review_submitted_at TIMESTAMPTZ,
  approval_at TIMESTAMPTZ,
  time_to_first_response_hours NUMERIC,
  time_to_approval_hours NUMERIC,
  review_rounds INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  is_ai_assisted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_efficiency_metrics_tenant_date ON review_efficiency_metrics (tenant_id, first_review_requested_at);
CREATE INDEX IF NOT EXISTS idx_review_efficiency_metrics_pr ON review_efficiency_metrics (pull_request_id);
CREATE INDEX IF NOT EXISTS idx_review_efficiency_metrics_reviewer ON review_efficiency_metrics (tenant_id, reviewer_name);

-- 0008_delivery_flow_quality_metrics.sql
-- Add tables for Tier 3 and 4 KPIs: Throughput, WIP, Flow Efficiency, Quality metrics

-- Throughput tracking - detailed metrics per period
CREATE TABLE IF NOT EXISTS throughput_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  period_type TEXT NOT NULL, -- 'daily', 'weekly', 'sprint'
  completed_tickets INTEGER NOT NULL DEFAULT 0,
  completed_story_points NUMERIC NOT NULL DEFAULT 0,
  merged_prs INTEGER NOT NULL DEFAULT 0,
  commits_count INTEGER NOT NULL DEFAULT 0,
  team_size INTEGER,
  throughput_per_developer NUMERIC, -- Tickets or points per dev
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_throughput_metrics_tenant_date ON throughput_metrics (tenant_id, snapshot_date, period_type);

-- Sprint Predictability metrics
CREATE TABLE IF NOT EXISTS sprint_predictability_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sprint_name TEXT NOT NULL,
  sprint_start_date DATE NOT NULL,
  sprint_end_date DATE NOT NULL,
  committed_story_points NUMERIC NOT NULL,
  completed_story_points NUMERIC NOT NULL,
  predictability_percent NUMERIC, -- Completed / Committed * 100
  tickets_completed INTEGER,
  tickets_committed INTEGER,
  team_size INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sprint_predictability_tenant_sprint ON sprint_predictability_metrics (tenant_id, sprint_start_date);

-- Work in Progress tracking
CREATE TABLE IF NOT EXISTS wip_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_in_progress INTEGER NOT NULL DEFAULT 0,
  in_progress_per_developer NUMERIC,
  critical_tickets_in_progress INTEGER DEFAULT 0,
  team_size INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wip_metrics_tenant_date ON wip_metrics (tenant_id, snapshot_date);

-- Flow Efficiency - status transition tracking
CREATE TABLE IF NOT EXISTS flow_efficiency_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  issue_id TEXT,
  total_elapsed_hours NUMERIC NOT NULL,
  active_work_hours NUMERIC NOT NULL, -- Time spent in "In Progress"
  flow_efficiency_percent NUMERIC, -- Active work / Total elapsed
  blocked_hours NUMERIC DEFAULT 0,
  waiting_hours NUMERIC DEFAULT 0,
  review_hours NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_efficiency_metrics_tenant_date ON flow_efficiency_metrics (tenant_id, created_at);

-- Bug Escape Rate - production bugs vs total bugs
CREATE TABLE IF NOT EXISTS bug_escape_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_bugs INTEGER NOT NULL DEFAULT 0,
  production_bugs INTEGER NOT NULL DEFAULT 0,
  escape_rate NUMERIC, -- Production / Total * 100
  critical_escapes INTEGER DEFAULT 0,
  high_escapes INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_escape_metrics_tenant_date ON bug_escape_metrics (tenant_id, snapshot_date);

-- Track individual bugs
CREATE TABLE IF NOT EXISTS bug_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  jira_key TEXT,
  external_id TEXT,
  title TEXT NOT NULL,
  severity TEXT, -- 'critical', 'high', 'medium', 'low'
  environment TEXT, -- 'production', 'staging', 'development'
  escape_type TEXT, -- 'escaped_to_production', 'found_in_dev', 'found_in_qa'
  created_at TIMESTAMPTZ NOT NULL,
  discovered_at TIMESTAMPTZ,
  fixed_at TIMESTAMPTZ,
  related_deployment_id UUID REFERENCES deployments(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  indexed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_tracking_tenant_environment ON bug_tracking (tenant_id, environment);
CREATE INDEX IF NOT EXISTS idx_bug_tracking_tenant_date ON bug_tracking (tenant_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bug_tracking_external_id ON bug_tracking (tenant_id, jira_key);

-- Rework Rate - reopened issues tracking
CREATE TABLE IF NOT EXISTS rework_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_completed_issues INTEGER NOT NULL DEFAULT 0,
  reopened_issues INTEGER NOT NULL DEFAULT 0,
  rework_rate NUMERIC, -- Reopened / Total Completed * 100
  total_reverted_prs INTEGER DEFAULT 0,
  total_follow_up_prs INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rework_metrics_tenant_date ON rework_metrics (tenant_id, snapshot_date);

-- Track individual rework instances
CREATE TABLE IF NOT EXISTS rework_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_issue_id TEXT,
  reopened_issue_id TEXT,
  reopened_reason TEXT,
  original_closed_at TIMESTAMPTZ,
  reopened_at TIMESTAMPTZ,
  closed_again_at TIMESTAMPTZ,
  related_pr_id UUID REFERENCES pull_requests(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rework_tracking_tenant_date ON rework_tracking (tenant_id, reopened_at);

-- Code Churn - high-activity commits shortly after merge
CREATE TABLE IF NOT EXISTS code_churn_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  original_lines_added INTEGER,
  original_lines_deleted INTEGER,
  original_files_changed INTEGER,
  follow_up_commits_within_24h INTEGER DEFAULT 0,
  follow_up_lines_modified NUMERIC DEFAULT 0,
  churn_percent NUMERIC, -- Lines modified in follow-ups / original lines changed
  time_to_first_fix_hours NUMERIC,
  is_ai_assisted BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_churn_metrics_tenant_date ON code_churn_metrics (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_code_churn_metrics_pr ON code_churn_metrics (pull_request_id);

-- Daily aggregate for code churn
CREATE TABLE IF NOT EXISTS code_churn_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  avg_churn_percent NUMERIC,
  high_churn_prs_count INTEGER DEFAULT 0, -- Churn > 30%
  median_churn_percent NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_churn_daily_metrics_tenant_date ON code_churn_daily_metrics (tenant_id, snapshot_date);

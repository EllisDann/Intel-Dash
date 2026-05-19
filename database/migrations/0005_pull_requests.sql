-- 0005_pull_requests.sql
-- Add pull request tracking for GitHub PR metrics

CREATE TABLE IF NOT EXISTS pull_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'github',
  source_id TEXT NOT NULL,
  repo_name TEXT,
  pr_number INTEGER,
  title TEXT,
  state TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  merged_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  external_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  indexed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pull_requests_tenant_merged ON pull_requests (tenant_id, merged_at);
CREATE INDEX IF NOT EXISTS idx_pull_requests_source ON pull_requests (tenant_id, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pull_requests_external_id ON pull_requests (tenant_id, source_id, external_id);

CREATE TABLE IF NOT EXISTS pr_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  pull_request_id UUID NOT NULL,
  reviewer TEXT,
  state TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_reviews_pr ON pr_reviews (pull_request_id);
CREATE INDEX IF NOT EXISTS idx_pr_reviews_tenant ON pr_reviews (tenant_id, submitted_at);

-- PR metrics: cycle time breakdown
-- cycle_time = merged_at - created_at
-- time_to_first_review = first_review_submitted_at - created_at
-- review_time = merged_at - first_review_submitted_at (if approved before merge)
-- merge_wait_time = merged_at - last_approval_at (time between last approval and merge)
CREATE TABLE IF NOT EXISTS pr_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  pull_request_id UUID NOT NULL,
  pr_cycle_time_hours NUMERIC,
  time_to_first_review_hours NUMERIC,
  review_time_hours NUMERIC,
  merge_wait_time_hours NUMERIC,
  review_rounds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_metrics_tenant_pr ON pr_metrics (tenant_id, pull_request_id);

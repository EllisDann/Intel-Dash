import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { query } from '../db';

const router = Router();

router.get('/api/dashboard/summary', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const tenantResult = await query(
      'SELECT id, name, trial_start_date, trial_end_date, is_trial_active, payment_status FROM tenants WHERE id = $1',
      [user.tenant_id]
    );

    if (tenantResult.rowCount === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = tenantResult.rows[0];
    const integrationsResult = await query(
      'SELECT id, type, display_name, is_connected, connected_at, disconnected_at FROM integrations WHERE tenant_id = $1 ORDER BY type',
      [user.tenant_id]
    );

    const integrations = integrationsResult.rows;
    const connectedCount = integrations.filter((item) => item.is_connected).length;
    const trialEndsInDays = tenant.trial_end_date
      ? Math.max(0, Math.ceil((new Date(tenant.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    return res.json({
      user: {
        id: user.sub,
        email: user.email,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        isTrialActive: tenant.is_trial_active,
        trialStartDate: tenant.trial_start_date,
        trialEndDate: tenant.trial_end_date,
        paymentStatus: tenant.payment_status,
        trialEndsInDays,
      },
      summary: {
        totalIntegrations: integrations.length,
        connectedIntegrations: connectedCount,
        hasConnectedIntegrations: connectedCount > 0,
      },
      integrations,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load dashboard summary' });
  }
});

// Lightweight metrics endpoint - returns an activity board summary payload.
router.get('/api/dashboard/metrics', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const now = new Date();
    const defaultEndDate = now.toISOString().slice(0, 10);
    const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const startDate = (req.query.startDate as string) || defaultStartDate;
    const endDate = (req.query.endDate as string) || defaultEndDate;

    const [prStatsRes, throughputRes, issueStatsRes, projectIssuesRes, reviewRes, reviewProjectsRes, commentRes, commentProjectsRes] =
      await Promise.all([
        query(
          `SELECT
             COUNT(*) FILTER (WHERE created_at::date BETWEEN $2::date AND $3::date)::int AS opened_prs,
             COUNT(*) FILTER (WHERE merged_at::date BETWEEN $2::date AND $3::date)::int AS completed_prs,
             AVG(CASE
                   WHEN metadata ? 'additions' AND metadata ? 'deletions'
                   THEN ((metadata->>'additions')::int + (metadata->>'deletions')::int)
                   ELSE NULL
                 END) FILTER (WHERE created_at::date BETWEEN $2::date AND $3::date)::numeric AS avg_pr_size,
             SUM(CASE
                   WHEN metadata ? 'additions' AND metadata ? 'deletions'
                   THEN ((metadata->>'additions')::int + (metadata->>'deletions')::int)
                   ELSE COALESCE(cm.original_lines_added + cm.original_lines_deleted, 0)
                 END) FILTER (WHERE created_at::date BETWEEN $2::date AND $3::date)::int AS total_loc,
             COUNT(DISTINCT CASE WHEN metadata ? 'author' THEN metadata->>'author' END) FILTER (WHERE created_at::date BETWEEN $2::date AND $3::date)::int AS pr_authors
           FROM pull_requests pr
           LEFT JOIN code_churn_metrics cm ON cm.pull_request_id = pr.id
           WHERE pr.tenant_id = $1
             AND (pr.created_at::date BETWEEN $2::date AND $3::date OR pr.merged_at::date BETWEEN $2::date AND $3::date)
          `,
          [user.tenant_id, startDate, endDate]
        ),
        query(
          `SELECT
             COALESCE(SUM(commits_count), 0)::int AS commits_made,
             COALESCE(SUM(completed_story_points), 0)::numeric AS story_points_completed
           FROM throughput_metrics
           WHERE tenant_id = $1 AND period_type = 'daily' AND snapshot_date BETWEEN $2::date AND $3::date`,
          [user.tenant_id, startDate, endDate]
        ),
        query(
          `SELECT
             COUNT(*) FILTER (WHERE created_at::date BETWEEN $2::date AND $3::date)::int AS opened_issues,
             COUNT(*) FILTER (WHERE completed_at::date BETWEEN $2::date AND $3::date)::int AS closed_issues,
             COUNT(DISTINCT CASE WHEN created_at::date BETWEEN $2::date AND $3::date THEN dwi.developer_id::text END)::int AS issue_authors
           FROM work_items w
           LEFT JOIN developer_work_items dwi ON dwi.work_item_id = w.id AND dwi.tenant_id = w.tenant_id
           WHERE w.tenant_id = $1`,
          [user.tenant_id, startDate, endDate]
        ),
        query(
          `SELECT
             COALESCE(w.source_id, w.source_type, 'unknown') AS project_name,
             COALESCE(w.source_id, w.source_type, 'unknown') AS project_id,
             COUNT(*)::int AS created,
             SUM(CASE WHEN w.completed_at IS NULL OR w.completed_at::date > $3::date THEN 1 ELSE 0 END)::int AS open,
             SUM(CASE WHEN w.completed_at::date BETWEEN $2::date AND $3::date THEN 1 ELSE 0 END)::int AS closed
           FROM work_items w
           WHERE w.tenant_id = $1 AND w.created_at::date BETWEEN $2::date AND $3::date
           GROUP BY project_name, project_id
           ORDER BY created DESC
           LIMIT 20`,
          [user.tenant_id, startDate, endDate]
        ),
        query(
          `SELECT
             COUNT(*)::int AS total_reviews,
             COUNT(DISTINCT reviewer_name)::int AS reviewers,
             AVG(review_rounds)::numeric AS avg_reviews_for_approval,
             AVG(review_rounds)::numeric AS review_distribution
           FROM review_efficiency_metrics
           WHERE tenant_id = $1 AND created_at::date BETWEEN $2::date AND $3::date`,
          [user.tenant_id, startDate, endDate]
        ),
        query(
          `SELECT
             COALESCE(pr.source_id, pr.repo_name, 'unknown') AS project_id,
             COALESCE(pr.repo_name, pr.source_id, 'unknown') AS project_name,
             COUNT(*)::int AS reviews,
             COUNT(DISTINCT rem.reviewer_name)::int AS reviewers,
             AVG(rem.review_rounds)::numeric AS avg_reviews_per_pr
           FROM review_efficiency_metrics rem
           JOIN pull_requests pr ON pr.id = rem.pull_request_id
           WHERE rem.tenant_id = $1 AND rem.created_at::date BETWEEN $2::date AND $3::date
           GROUP BY project_id, project_name
           ORDER BY reviews DESC
           LIMIT 20`,
          [user.tenant_id, startDate, endDate]
        ),
        query(
          `SELECT
             COALESCE(SUM(comments_count), 0)::int AS total_comments,
             COUNT(DISTINCT reviewer_name)::int AS commenters,
             CASE WHEN COUNT(DISTINCT pull_request_id) > 0
               THEN ROUND(SUM(comments_count)::numeric / COUNT(DISTINCT pull_request_id), 2)
               ELSE 0 END AS comments_distribution
           FROM review_efficiency_metrics
           WHERE tenant_id = $1 AND created_at::date BETWEEN $2::date AND $3::date`,
          [user.tenant_id, startDate, endDate]
        ),
        query(
          `SELECT
             COALESCE(pr.source_id, pr.repo_name, 'unknown') AS project_id,
             COALESCE(pr.repo_name, pr.source_id, 'unknown') AS project_name,
             COALESCE(SUM(rem.comments_count), 0)::int AS comments,
             COUNT(DISTINCT rem.reviewer_name)::int AS commenters,
             COUNT(DISTINCT rem.pull_request_id)::int AS discussed_items
           FROM review_efficiency_metrics rem
           JOIN pull_requests pr ON pr.id = rem.pull_request_id
           WHERE rem.tenant_id = $1 AND rem.created_at::date BETWEEN $2::date AND $3::date
           GROUP BY project_id, project_name
           ORDER BY comments DESC
           LIMIT 20`,
          [user.tenant_id, startDate, endDate]
        ),
      ]);

    const prStats = prStatsRes.rows[0] || {};
    const throughputStats = throughputRes.rows[0] || {};
    const issueStats = issueStatsRes.rows[0] || {};
    const reviewStats = reviewRes.rows[0] || {};
    const commentStats = commentRes.rows[0] || {};

    return res.json({
      openedPRs: prStats.opened_prs ?? 0,
      completedPRs: prStats.completed_prs ?? 0,
      averagePRSize: prStats.avg_pr_size !== null ? Number(prStats.avg_pr_size) : null,
      commitsMade: throughputStats.commits_made ?? 0,
      prAuthors: prStats.pr_authors ?? 0,
      totalLinesOfCode: prStats.total_loc ?? 0,
      openedIssues: issueStats.opened_issues ?? 0,
      issueAuthors: issueStats.issue_authors ?? 0,
      storyPointsCompleted: throughputStats.story_points_completed ?? 0,
      closedIssues: issueStats.closed_issues ?? 0,
      projectIssues: projectIssuesRes.rows,
      totalReviews: reviewStats.total_reviews ?? 0,
      reviewers: reviewStats.reviewers ?? 0,
      reviewsDistribution: reviewStats.review_distribution !== null ? Number(reviewStats.review_distribution) : null,
      averageReviewsForApproval: reviewStats.avg_reviews_for_approval !== null ? Number(reviewStats.avg_reviews_for_approval) : null,
      projectReviews: reviewProjectsRes.rows,
      totalComments: commentStats.total_comments ?? 0,
      commenters: commentStats.commenters ?? 0,
      commentsDistribution: commentStats.comments_distribution !== null ? Number(commentStats.comments_distribution) : null,
      projectComments: commentProjectsRes.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load metrics' });
  }
});

export default router;

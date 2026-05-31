import { query } from '../src/db';

(async () => {
  try {
    const now = new Date();
    const defaultEndDate = now.toISOString().slice(0, 10);
    const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const startDate = defaultStartDate;
    const endDate = defaultEndDate;

    const tenantRes = await query("SELECT DISTINCT tenant_id FROM work_items WHERE source_type = 'github' LIMIT 1");
    if (tenantRes.rowCount === 0) {
      console.log('No tenant found');
      process.exit(0);
    }
    const tenantId = tenantRes.rows[0].tenant_id;

    const rows = await query(
      `WITH repo_activity AS (
         SELECT
           pr.source_id AS id,
           COUNT(*)::int AS opened_prs,
           COALESCE(SUM(COALESCE((pr.metadata->>'commits')::int, 0)), 0)::int AS throughput,
           COALESCE(SUM(
             CASE
               WHEN pr.metadata ? 'additions' AND pr.metadata ? 'deletions'
                 THEN ((pr.metadata->>'additions')::int + (pr.metadata->>'deletions')::int)
               ELSE COALESCE(cm.original_lines_added + cm.original_lines_deleted, 0)
             END
           ), 0)::int AS loc
         FROM pull_requests pr
         LEFT JOIN code_churn_metrics cm ON cm.pull_request_id = pr.id
         WHERE pr.tenant_id = $1 AND pr.created_at::date BETWEEN $2::date AND $3::date
         GROUP BY pr.source_id
       ),
       imported_repos AS (
         SELECT w.source_type, w.source_id AS id
         FROM work_items w
         WHERE w.tenant_id = $1 AND w.source_type = 'github'
       )
       SELECT
         COALESCE(ir.source_type, 'github') AS source_type,
         COALESCE(ir.id, ra.id) AS id,
         COALESCE(ra.throughput, 0)::int AS throughput,
         COALESCE(ra.opened_prs, 0)::int AS opened_prs,
         COALESCE(ra.loc, 0)::int AS loc
       FROM imported_repos ir
       FULL OUTER JOIN repo_activity ra ON ra.id = ir.id
       ORDER BY throughput DESC
       LIMIT 50`,
      [tenantId, startDate, endDate]
    );

    console.log('Repo query rows:', rows.rowCount);
    console.table(rows.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

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

// Lightweight metrics endpoint - returns tenant time series when available.
// If no tenant metrics exist, return empty series (no sample data shown).
router.get('/api/dashboard/metrics', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;

    // Check if there are any metric snapshots for this tenant
    const existRes = await query(
      `SELECT 1 FROM metric_snapshots WHERE tenant_id = $1 LIMIT 1`,
      [user.tenant_id]
    );

    if (existRes.rowCount === 0) {
      // No real data yet.
      // If the requesting user is the demo account, return deterministic demo series.
      if (user.email && user.email.toLowerCase() === 'test@test.com') {
        const now = new Date();
        const throughputSeries: Array<{ date: string; value: number }> = [];
        const cycleTimeSeries: Array<{ date: string; avg_hours: number }> = [];

        for (let i = 7; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i * 7);
          const iso = d.toISOString().slice(0, 10);
          const t = Math.max(0, Math.floor(8 + (i * 2) + (d.getDate() % 5)));
          const c = Math.max(4, Math.floor(28 - i * 2 + (d.getDate() % 3)));
          throughputSeries.push({ date: iso, value: t });
          cycleTimeSeries.push({ date: iso, avg_hours: c });
        }

        const aiComparison = {
          preAdoption: { throughput: 8, avg_cycle_time_hours: 30 },
          postAdoption: { throughput: 12, avg_cycle_time_hours: 24 },
          improvement: { throughput_pct: 50, cycle_time_pct: -20 },
        };

        return res.json({ throughputSeries, cycleTimeSeries, aiComparison });
      }

      // Otherwise return empty series so frontend shows CTA/empty state
      return res.json({ throughputSeries: [], cycleTimeSeries: [], aiComparison: null });
    }

    // Fetch recent up-to-8 daily snapshots for throughput and cycle time
    const rows = await query(
      `SELECT snapshot_date::text AS date,
              MAX(CASE WHEN metric_type = 'throughput' THEN value END) AS throughput,
              MAX(CASE WHEN metric_type = 'cycle_time_avg_hours' THEN value END) AS cycle_avg
       FROM metric_snapshots
       WHERE tenant_id = $1
         AND snapshot_date >= (CURRENT_DATE - INTERVAL '56 days')::date
         AND metric_type IN ('throughput', 'cycle_time_avg_hours')
       GROUP BY snapshot_date
       ORDER BY snapshot_date DESC
       LIMIT 8`,
      [user.tenant_id]
    );

    // rows may be in descending order; normalize to ascending
    const sorted = rows.rows.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const throughputSeries = sorted.map((r: any) => ({ date: r.date, value: r.throughput ? Number(r.throughput) : 0 }));
    const cycleTimeSeries = sorted.map((r: any) => ({ date: r.date, avg_hours: r.cycle_avg ? Number(r.cycle_avg) : null }));

    // Basic AI comparison is derived from ai_adoption_dates if present; keep null if not available
    const adoptionRes = await query(
      `SELECT adoption_date::date AS adoption_date FROM ai_adoption_dates WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [user.tenant_id]
    );
    const adoptionDate = adoptionRes.rows[0]?.adoption_date || null;

    const aiComparison = adoptionDate ? { adoptionDate } : null;

    return res.json({ throughputSeries, cycleTimeSeries, aiComparison });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load metrics' });
  }
});

export default router;

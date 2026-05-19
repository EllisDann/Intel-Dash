import { query } from './db';
import { computeDailyMetrics } from './jobs/metricJobs';

export const scheduleMetrics = () => {
  const runDaily = async () => {
    try {
      const tenants = await query('SELECT id FROM tenants WHERE is_active = true');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isoDate = yesterday.toISOString().slice(0, 10);

      console.log(`Running daily metric calculation for ${tenants.rowCount} tenants on ${isoDate}`);
      for (const tenant of tenants.rows) {
        try {
          await computeDailyMetrics(tenant.id, isoDate);
        } catch (error) {
          console.error(`Metrics failed for tenant ${tenant.id}`, error);
        }
      }
    } catch (error) {
      console.error('Failed to run daily metrics schedule', error);
    }
  };

  // run once at startup, then once every 24 hours
  runDaily();
  const intervalMs = 24 * 60 * 60 * 1000;
  setInterval(runDaily, intervalMs);
};

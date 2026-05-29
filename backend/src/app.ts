import './loadEnv';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import integrationsRouter from './routes/integrations';
import dashboardRouter from './routes/dashboard';
import metricsRouter from './routes/metrics';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Intel-Dash backend' });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use(authRouter);
app.use(userRouter);
app.use(integrationsRouter);
app.use(dashboardRouter);
app.use(metricsRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;

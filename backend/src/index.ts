import app from './app';
import { scheduleMetrics } from './scheduler';

const port = process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 3001;

app.listen(port, () => {
  console.log(`IntelBoard backend listening on port ${port}`);
  scheduleMetrics();
});

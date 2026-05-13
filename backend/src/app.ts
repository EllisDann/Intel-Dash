import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'IntelBoard backend' });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

export default app;

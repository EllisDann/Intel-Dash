import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env');
const parentEnvPath = path.resolve(process.cwd(), '..', '.env');
const configPath = fs.existsSync(envPath) ? envPath : parentEnvPath;

dotenv.config({ path: configPath });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = async (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export const getClient = async () => {
  return pool.connect();
};

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const parentEnvPath = path.resolve(process.cwd(), '..', '.env');
const configPath = fs.existsSync(envPath) ? envPath : parentEnvPath;

dotenv.config({ path: configPath });

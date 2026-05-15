const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..', '..');
const envPath = path.resolve(repoRoot, '.env');

dotenv.config({ path: envPath });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not defined in .env');
  process.exit(1);
}

const targetUrl = new URL(databaseUrl);
const targetDb = targetUrl.pathname.replace(/^\//, '');

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';

const runSqlFile = async (pool, fileName) => {
  const filePath = path.resolve(repoRoot, 'database', 'migrations', fileName);
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`Applying migration: ${fileName}`);
  await pool.query(sql);
};

const bootstrap = async () => {
  const adminPool = new Pool({ connectionString: adminUrl.toString() });
  try {
    await adminPool.query(`CREATE DATABASE "${targetDb}"`);
    console.log(`Created database ${targetDb}`);
  } catch (error) {
    if (error.code === '42P04') {
      console.log(`Database ${targetDb} already exists`);
    } else {
      console.error('Unable to create database', error);
      throw error;
    }
  } finally {
    await adminPool.end();
  }

  const appPool = new Pool({ connectionString: databaseUrl });
  try {
    await runSqlFile(appPool, '0001_initial.sql');
    await runSqlFile(appPool, '0002_add_integrations_and_trial_metadata.sql');
    console.log('Migrations applied successfully.');
  } finally {
    await appPool.end();
  }
};

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

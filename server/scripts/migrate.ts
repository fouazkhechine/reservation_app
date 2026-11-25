import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 10_000,
  ...(process.env.PGSSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
});

const migrationDirectory = join(process.cwd(), 'db', 'migrations');
const files = (await readdir(migrationDirectory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
const client = await pool.connect();
try {
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    const table = (await client.query("SELECT to_regclass('public.schema_migrations') AS name")).rows[0]?.name;
    if (table) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
      if (applied.rowCount) { console.log(`migration ${version}: already applied`); continue; }
    }
    await client.query('BEGIN');
    try {
      await client.query(await readFile(join(migrationDirectory, file), 'utf8'));
      const afterTable = (await client.query("SELECT to_regclass('public.schema_migrations') AS name")).rows[0]?.name;
      if (afterTable) await client.query('INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING', [version]);
      await client.query('COMMIT');
      console.log(`migration ${version}: applied`);
    } catch (migrationError) {
      await client.query('ROLLBACK');
      throw migrationError;
    }
  }
} finally {
  client.release();
  await pool.end();
}

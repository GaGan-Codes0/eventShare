/** Applies pending SQL migrations from ./drizzle, then exits. Runs before the API starts in production. */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import { loadEnv } from '../config/env.js';

const pool = new pg.Pool({ connectionString: loadEnv().DATABASE_URL, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  console.log('migrations applied');
} finally {
  await pool.end();
}

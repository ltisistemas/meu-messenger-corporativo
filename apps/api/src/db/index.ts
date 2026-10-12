import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index';

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://nextmsg_user:nextmsg_password@localhost:5432/nextmsg_db';

const isServerless = Boolean(process.env.VERCEL);
const hasSslHint =
  connectionString.includes('sslmode=require') ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('supabase') ||
  connectionString.includes('pooler.supabase.com') ||
  process.env.DATABASE_SSL === 'true';

export const pool = new Pool({
  connectionString,
  max: isServerless ? 5 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: hasSslHint ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  // Prevent unhandled error event from crashing the process
  console.warn(`[PG Pool Error]: ${err.message}`);
});

export const db = drizzle(pool, { schema });
export { schema };

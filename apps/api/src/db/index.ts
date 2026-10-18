import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index';

import dotenv from 'dotenv';
import path from 'path';

// Safely load .env from current directory or monorepo root if running locally
if (!process.env.VERCEL) {
  dotenv.config();
  try {
    dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  } catch {
    // Ignore in non-standard execution environments
  }
}

const { Pool } = pg;

const connectionString =
  (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== ''
    ? process.env.DATABASE_URL
    : undefined) ||
  (process.env.POSTGRES_URL && process.env.POSTGRES_URL.trim() !== ''
    ? process.env.POSTGRES_URL
    : undefined) ||
  (process.env.PRISMA_DATABASE_URL && process.env.PRISMA_DATABASE_URL.trim() !== ''
    ? process.env.PRISMA_DATABASE_URL
    : undefined) ||
  'postgresql://nextmsg_user:nextmsg_password@localhost:5432/nextmsg_db';

const isServerless = Boolean(process.env.VERCEL);
const hasSslHint =
  connectionString.includes('sslmode=require') ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('supabase') ||
  connectionString.includes('pooler.supabase.com') ||
  connectionString.includes('prisma.io') ||
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

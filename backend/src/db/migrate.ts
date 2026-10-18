import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index';
import path from 'path';
const migrationsFolder = typeof __dirname !== 'undefined' 
  ? path.resolve(__dirname, './migrations')
  : path.resolve(process.cwd(), 'src/db/migrations');

export async function runMigrations() {
  console.log('Running database migrations...');
  const migrationsFolder = path.resolve(__dirname, './migrations');
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied successfully.');
}

if (process.argv[1] === __filename) {
  runMigrations()
    .then(() => {
      console.log('Migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await pool.end();
    });
}

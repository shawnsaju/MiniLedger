import { loadConfig } from './config';
import { createPool, migrate } from './db';

async function main() {
  const pool = createPool(loadConfig().databaseUrl);
  await migrate(pool);
  await pool.end();
  console.log('Migration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

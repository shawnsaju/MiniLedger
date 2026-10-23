import { createApp } from './app';
import { loadConfig } from './config';
import { createPool, migrate } from './db';

async function main() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  await migrate(pool); // creates tables on first run

  const app = createApp({ db: pool, config });
  // Bind to all interfaces so a phone on the same Wi-Fi can reach the API.
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`MiniLedger API listening on http://0.0.0.0:${config.port}`);
    console.log('OTPs are printed in this log (mock SMS).');
  });

  const shutdown = () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

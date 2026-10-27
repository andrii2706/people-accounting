/**
 * Runs migrations as a separate process (Cloud Run Job before deploying a new API version):
 *   node dist/database/migrate.js
 */
import 'reflect-metadata';
import { loadEnv } from '../config/env.js';
import dataSource from './data-source.js';

async function main() {
  loadEnv(); // configuration check, including encryption keys (needed by data migrations)
  await dataSource.initialize();
  const applied = await dataSource.runMigrations({ transaction: 'each' });
  console.log(applied.length ? `Застосовано міграцій: ${applied.map((m) => m.name).join(', ')}` : 'Нових міграцій немає');
  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

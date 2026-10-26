/**
 * Запуск міграцій окремим процесом (Cloud Run Job перед деплоєм нової версії API):
 *   node dist/database/migrate.js
 */
import 'reflect-metadata';
import { loadEnv } from '../config/env.js';
import dataSource from './data-source.js';

async function main() {
  loadEnv(); // перевірка конфігурації, зокрема ключів шифрування (потрібні міграції даних)
  await dataSource.initialize();
  const applied = await dataSource.runMigrations({ transaction: 'each' });
  console.log(applied.length ? `Застосовано міграцій: ${applied.map((m) => m.name).join(', ')}` : 'Нових міграцій немає');
  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

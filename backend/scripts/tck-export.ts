/**
 * Exports the TCK directory from a database (usually your local one) to a JSON file,
 * which is then uploaded in the app: Налаштування → ТЦК → «Імпорт з файлу».
 *
 *   npm run tck:export                       # from DATABASE_URL in .env → tck-export.json
 *   npm run tck:export -- my-file.json       # another file name
 *
 * Only the directory is exported (names, addresses, postal codes, contacts) — no personal data.
 */
import { writeFileSync } from 'node:fs';
import { Client } from 'pg';

const out = process.argv[2] ?? 'tck-export.json';
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Не задано DATABASE_URL (локальна база, з якої експортувати ТЦК)');
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query(
    `SELECT name, "nameGenitive", address, "postalCode", phone, email, "isActive" FROM tck ORDER BY name`,
  );
  writeFileSync(out, JSON.stringify({ format: 'military-registry/tck', version: 1, items: rows }, null, 2));
  console.log(`✔ Експортовано ТЦК: ${rows.length} → ${out}`);
  console.log('  Далі: Налаштування → ТЦК → «Імпорт з файлу» у робочому застосунку.');
} finally {
  await client.end();
}

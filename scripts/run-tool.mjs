#!/usr/bin/env node
/**
 * Runs a tool installed in backend/ or frontend/ straight with node — for the git hooks (lint-staged):
 *   node scripts/run-tool.mjs frontend prettier --write a.ts b.html
 * Without npm in between: on Windows `npm exec` from a hook fails without a message (spawning npm.cmd),
 * and every part keeps its own node_modules.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [part, tool, ...args] = process.argv.slice(2);
if (!part || !tool) {
  console.error('Як запускати: node scripts/run-tool.mjs <frontend|backend> <інструмент> [аргументи]');
  process.exit(2);
}

const pkgFile = join(root, part, 'node_modules', tool, 'package.json');
if (!existsSync(pkgFile)) {
  console.error(`Немає ${tool} у ${part}/node_modules. Виконайте: cd ${part} && npm install`);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[tool];
if (!bin) {
  console.error(`${tool} не має команди для запуску (package.json → bin)`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [join(dirname(pkgFile), bin), ...args], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);

#!/usr/bin/env node
/**
 * Deletes the files that newer versions removed. A zip only adds and replaces files, so after unpacking a new version
 * over the repository the removed ones stay and may break the build.   npm run cleanup
 * Inside git the deletion is staged (git rm), so it goes into the next commit; outside git the files are just deleted.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The removed paths, by the version that removed them. */
const REMOVED = {
  v108: [
    'frontend/src/app/shared/services/idle-timeout.service.ts',
    'frontend/src/app/shared/services/idle-timeout.service.spec.ts',
  ],
  v109: ['frontend/src/mr-ui'],
};

let removed = 0;
for (const [version, paths] of Object.entries(REMOVED)) {
  for (const path of paths) {
    const full = join(root, path);
    if (!existsSync(full)) continue;
    try {
      execFileSync('git', ['rm', '-r', '-q', '--ignore-unmatch', '--', path], { cwd: root, stdio: 'pipe' });
    } catch {
      // not a git repository, or the file is not tracked
    }
    if (existsSync(full)) rmSync(full, { recursive: true, force: true });
    console.log(`видалено (${version}): ${path}`);
    removed++;
  }
}
console.log(removed ? `Готово: ${removed}. Закомітьте видалення.` : 'Нічого видаляти — усе вже чисто.');

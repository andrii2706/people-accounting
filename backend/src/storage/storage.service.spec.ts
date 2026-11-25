import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StorageService } from './storage.service.js';

let dir: string;
let storage: StorageService;
let n = 0;
/** A fresh key prefix per test — the folder is shared by the tests of this file. */
const key = (k: string) => `t${n}/${k}`;

beforeAll(async () => {
  // a throwaway folder — never the real storage of the app (the configuration is read once per test file)
  dir = await mkdtemp(join(tmpdir(), 'mr-storage-'));
  process.env['STORAGE_DRIVER'] = 'local';
  process.env['STORAGE_LOCAL_DIR'] = relative(process.cwd(), dir);
  storage = new StorageService();
  const root = (storage as unknown as { driver: { root: string } }).driver.root;
  if (root !== dir) throw new Error(`the test storage must be the temporary folder, not ${root}`);
});
afterAll(async () => {
  delete process.env['STORAGE_LOCAL_DIR'];
  await rm(dir, { recursive: true, force: true });
});

describe('StorageService (локальна тека)', () => {
  it('записати, перевірити, прочитати', async () => {
    n++;
    expect(await storage.put(key('letters/document.docx'), Buffer.from('doc'))).toEqual({
      key: key('letters/document.docx'),
      size: 3,
    });
    expect(await storage.exists(key('letters/document.docx'))).toBe(true);
    expect((await storage.get(key('letters/document.docx'))).toString()).toBe('doc');
    expect(await storage.exists(key('letters/other.docx'))).toBe(false);
  });

  it('файл пишеться один раз — перезаписати не можна; немає — «не знайдено»', async () => {
    n++;
    await storage.put(key('a.txt'), Buffer.from('1'));
    await expect(storage.put(key('a.txt'), Buffer.from('2'))).rejects.toBeTruthy();
    expect((await storage.get(key('a.txt'))).toString()).toBe('1');
    await expect(storage.get(key('none.txt'))).rejects.toThrow('Файл не знайдено');
  });

  it('ключ поза текою сховища — відмова', async () => {
    await expect(storage.put('../escape.txt', Buffer.from('x'))).rejects.toThrow('Некоректний ключ');
  });
});

// Loader of the IIT library «Користувач ЦСК» for Node.js (backend/iit/README.md).
// The server calls createVerifier() once and then VerifyData(data, sign) for every check.
//
// It works without manual edits: the module of the library is found in this folder (or one level
// deeper), the lists of qualified providers (CAs.json, CACertificates.p7b) are taken from here too —
// the deploy downloads them from czo.gov.ua. If the IIT package of your version is laid out differently,
// set IIT_MODULE (path relative to this folder) and/or IIT_EXPORT (the name of the EndUser export).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** File names the IIT Node.js package used in different versions. */
const MODULE_NAMES = ['euscp.js', 'euscp.node', 'EUSignCP.js', 'eusign.js', 'index.js'];
/** Export names of the EndUser class. */
const EXPORT_NAMES = ['EndUser', 'EUSignCP', 'EUSign'];
const CA_JSON = 'CAs.json';
const CA_CERTIFICATES = 'CACertificates.p7b';

function findModule() {
  if (process.env.IIT_MODULE) return join(here, process.env.IIT_MODULE);
  const dirs = [here];
  for (const name of readdirSync(here)) {
    const path = join(here, name);
    if (statSync(path).isDirectory() && name !== 'node_modules') dirs.push(path);
  }
  for (const dir of dirs) {
    for (const name of MODULE_NAMES) {
      const path = join(dir, name);
      if (existsSync(path)) return path;
    }
  }
  throw new Error(
    `Бібліотеку ІІТ не знайдено в ${here}: очікувався один з файлів ${MODULE_NAMES.join(', ')}. ` +
      'Розпакуйте пакет ІІТ для Node.js у цю папку або задайте IIT_MODULE.',
  );
}

function endUserFactory(mod) {
  const candidates = [mod, mod?.default].filter(Boolean);
  const names = process.env.IIT_EXPORT ? [process.env.IIT_EXPORT] : EXPORT_NAMES;
  for (const c of candidates) {
    for (const name of names) {
      if (typeof c[name] === 'function') return c[name];
    }
  }
  if (typeof mod === 'function') return mod;
  if (typeof mod?.default === 'function') return mod.default;
  throw new Error(`У модулі ІІТ немає експорту ${names.join(' / ')} — задайте IIT_EXPORT`);
}

async function readCaFiles() {
  const missing = [CA_JSON, CA_CERTIFICATES].filter((name) => !existsSync(join(here, name)));
  if (missing.length) {
    throw new Error(`Немає ${missing.join(', ')} у ${here} — завантажте з https://czo.gov.ua/download/certificates/`);
  }
  return {
    CAs: JSON.parse(await readFile(join(here, CA_JSON), 'utf8')),
    CACertificates: new Uint8Array(await readFile(join(here, CA_CERTIFICATES))),
  };
}

export async function createVerifier() {
  const modulePath = findModule();
  const EndUser = endUserFactory(require(modulePath));
  let eu;
  try {
    eu = new EndUser();
  } catch {
    eu = await EndUser();
  }
  if (typeof eu.Initialize === 'function') {
    await eu.Initialize({
      language: 'uk',
      encoding: 'utf-8',
      httpProxyServiceURL: '',
      // the server reaches the OCSP / TSP of the providers directly
      directAccess: true,
      ...(await readCaFiles()),
      allowedKeyMediaTypes: [],
      // foreign (EU) qualified providers are not accepted for the sign-up
      allowForeignCAs: false,
    });
  }
  if (typeof eu.VerifyData !== 'function') {
    throw new Error(`Об’єкт ІІТ з ${relative(here, modulePath)} не має методу VerifyData — перевірте версію пакета`);
  }
  return eu;
}

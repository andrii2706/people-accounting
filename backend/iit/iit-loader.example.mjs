// Copy to iit-loader.mjs once the IIT library for Node.js is unpacked into this folder.
// The server calls createVerifier() once and then VerifyData(data, sign) for every check.
//
// ⚠️ The file name and the export of the IIT package differ between versions — check the example
// shipped by IIT and adjust the two marked lines. The settings are the EndUserSettings of the IIT API.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export async function createVerifier() {
  // (1) the IIT module and its EndUser class
  const { EndUser } = require(join(here, 'euscp.js'));
  const eu = new EndUser();

  await eu.Initialize({
    language: 'uk',
    encoding: 'utf-8',
    httpProxyServiceURL: '',
    // the server reaches the OCSP / TSP of the providers directly
    directAccess: true,
    // (2) the lists of qualified providers from czo.gov.ua
    CAs: JSON.parse(await readFile(join(here, 'CAs.json'), 'utf8')),
    CACertificates: new Uint8Array(await readFile(join(here, 'CACertificates.p7b'))),
    allowedKeyMediaTypes: [],
    // foreign (EU) qualified providers are not accepted for the sign-up
    allowForeignCAs: false,
  });
  return eu;
}

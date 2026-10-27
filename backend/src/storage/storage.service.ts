import { Global, Injectable, Logger, Module, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { loadEnv } from '../config/env.js';

/**
 * Storage for files that must outlive a request: frozen (signed) documents and signature files.
 *
 *  • local — a folder on disk (development, docker-compose);
 *  • gcs   — a Cloud Storage bucket. Recommended: uniform bucket-level access, public access prevention,
 *            a retention policy (e.g. 5 years) — then even a project administrator cannot
 *            delete or replace a signed document before the retention period ends.
 *
 * Files are write-once: overwriting an existing key is forbidden.
 */
export interface StoredObject {
  key: string;
  size: number;
}

interface Driver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
}

class LocalDriver implements Driver {
  private readonly root: string;
  constructor(dir: string) {
    this.root = resolve(dir);
  }
  private path(key: string) {
    const p = resolve(this.root, normalize(key));
    if (!p.startsWith(this.root + sep)) throw new Error('Некоректний ключ файлу');
    return p;
  }
  async put(key: string, data: Buffer) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    // flag 'wx' — never overwrite an existing file
    await writeFile(p, data, { flag: 'wx', mode: 0o600 });
  }
  async get(key: string) {
    try {
      return await readFile(this.path(key));
    } catch {
      throw new NotFoundException('Файл не знайдено у сховищі');
    }
  }
  async exists(key: string) {
    return stat(this.path(key)).then(
      () => true,
      () => false,
    );
  }
}

class GcsDriver implements Driver {
  private bucketPromise: Promise<import('@google-cloud/storage').Bucket>;
  constructor(bucketName: string) {
    // lazy loading: the package is not needed locally
    this.bucketPromise = import('@google-cloud/storage').then(({ Storage }) => new Storage().bucket(bucketName));
  }
  async put(key: string, data: Buffer, contentType: string) {
    const bucket = await this.bucketPromise;
    // ifGenerationMatch: 0 — write only if the object does not exist yet (write-once)
    await bucket.file(key).save(data, {
      contentType,
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { cacheControl: 'private, no-store' },
    });
  }
  async get(key: string) {
    const bucket = await this.bucketPromise;
    try {
      const [buf] = await bucket.file(key).download();
      return buf;
    } catch (err) {
      if ((err as { code?: number }).code === 404) throw new NotFoundException('Файл не знайдено у сховищі');
      throw err;
    }
  }
  async exists(key: string) {
    const bucket = await this.bucketPromise;
    const [ok] = await bucket.file(key).exists();
    return ok;
  }
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: Driver;

  constructor() {
    const env = loadEnv();
    this.driver =
      env.storageDriver === 'gcs'
        ? new GcsDriver(env.storageBucket)
        : new LocalDriver(join(process.cwd(), env.storageLocalDir));
    this.logger.log(`Сховище файлів: ${env.storageDriver === 'gcs' ? `gs://${env.storageBucket}` : env.storageLocalDir}`);
  }

  async put(key: string, data: Buffer, contentType = 'application/octet-stream'): Promise<StoredObject> {
    await this.driver.put(key, data, contentType);
    return { key, size: data.length };
  }

  get(key: string) {
    return this.driver.get(key);
  }

  exists(key: string) {
    return this.driver.exists(key);
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}

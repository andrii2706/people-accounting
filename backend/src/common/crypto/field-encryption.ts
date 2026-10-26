/**
 * Шифрування окремих полів у БД (AES-256-GCM) — захист на випадок витоку дампу/бекапу.
 * Формат: enc:v1:<iv>:<tag>:<ciphertext> (base64url). Старі незашифровані значення читаються як є.
 * Для пошуку за РНОКПП без розшифрування — «сліпий індекс» (HMAC-SHA256).
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { ValueTransformer } from 'typeorm';
import { loadEnv } from '../../config/env.js';

const PREFIX = 'enc:v1:';

function keys() {
  const env = loadEnv();
  return { data: env.dataKey, blind: env.blindIndexKey };
}

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX);
}

export function encryptField(plain: string | null | undefined): string | null | undefined {
  if (plain === null || plain === undefined || plain === '' || isEncrypted(plain)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keys().data, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptField(stored: string | null | undefined): string | null | undefined {
  if (!stored || !isEncrypted(stored)) return stored;
  const [iv, tag, data] = stored.slice(PREFIX.length).split(':');
  const decipher = createDecipheriv('aes-256-gcm', keys().data, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** Детермінований HMAC — дозволяє шукати за точним значенням, не зберігаючи його відкрито. */
export function blindIndex(value: string | null | undefined): string | null {
  const normalized = (value ?? '').replace(/\s+/g, '').toUpperCase();
  if (!normalized) return null;
  return createHmac('sha256', keys().blind).update(normalized).digest('hex');
}

/** TypeORM-трансформер для колонок, що зберігаються зашифрованими. */
export const encrypted: ValueTransformer = {
  to: (value: string | null | undefined) => encryptField(value),
  from: (value: string | null | undefined) => decryptField(value),
};

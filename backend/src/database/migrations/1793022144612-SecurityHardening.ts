import type { MigrationInterface, QueryRunner } from 'typeorm';
import { blindIndex, decryptField, encryptField } from '../../common/crypto/field-encryption.js';

/** Columns that are stored encrypted from now on. */
const ENCRYPTED = ['rnokpp', 'passportNumber', 'foreignPassportNumber', 'registryNumber', 'militaryDocNumber'] as const;
/** Fields removed from old audit entries (they were stored in plain text there). */
const SENSITIVE_AUDIT_KEYS = ['rnokpp', 'passportSeries', 'passportNumber', 'foreignPassportSeries', 'foreignPassportNumber', 'militaryDocNumber', 'registryNumber'];

/**
 * Security: session/lockout fields for users, encryption of sensitive employee fields,
 * blind index for RNOKPP. No data is lost: column types are changed in place,
 * existing values are encrypted with DATA_ENCRYPTION_KEY.
 */
export class SecurityHardening1793022144612 implements MigrationInterface {
  name = 'SecurityHardening1793022144612';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD "tokenVersion" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "users" ADD "failedLoginCount" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "users" ADD "lockedUntil" TIMESTAMP WITH TIME ZONE`);
    await q.query(`ALTER TABLE "users" ADD "mustChangePassword" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "users" ADD "passwordChangedAt" TIMESTAMP WITH TIME ZONE`);
    await q.query(`ALTER TABLE "users" ADD "lastLoginAt" TIMESTAMP WITH TIME ZONE`);

    await q.query(`DROP INDEX IF EXISTS "public"."IDX_65fbfbc9d07b4e4fcbcfd1ed68"`);
    for (const col of ENCRYPTED) {
      await q.query(`ALTER TABLE "employees" ALTER COLUMN "${col}" TYPE text`);
    }
    await q.query(`ALTER TABLE "employees" ADD "rnokppHash" character varying(64)`);
    await q.query(`CREATE INDEX "IDX_296118db7e4c0727bff2ae9992" ON "employees" ("rnokppHash")`);

    // encrypt existing data (row by row — a company has few employees)
    const rows: Record<string, string>[] = await q.query(`SELECT "id", ${ENCRYPTED.map((c) => `"${c}"`).join(', ')} FROM "employees"`);
    for (const row of rows) {
      const values = ENCRYPTED.map((c) => encryptField(row[c]) ?? '');
      await q.query(
        `UPDATE "employees" SET ${ENCRYPTED.map((c, i) => `"${c}" = $${i + 1}`).join(', ')}, "rnokppHash" = $${ENCRYPTED.length + 1} WHERE "id" = $${ENCRYPTED.length + 2}`,
        [...values, blindIndex(row.rnokpp), row.id],
      );
    }

    // audit log: remove plain values of sensitive fields
    await q.query(
      `UPDATE "audit_log" SET "diff" = "diff" ${SENSITIVE_AUDIT_KEYS.map((k) => `- '${k}'`).join(' ')} WHERE "diff" ?| $1`,
      [SENSITIVE_AUDIT_KEYS],
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    const rows: Record<string, string>[] = await q.query(`SELECT "id", ${ENCRYPTED.map((c) => `"${c}"`).join(', ')} FROM "employees"`);
    for (const row of rows) {
      const values = ENCRYPTED.map((c) => decryptField(row[c]) ?? '');
      await q.query(`UPDATE "employees" SET ${ENCRYPTED.map((c, i) => `"${c}" = $${i + 1}`).join(', ')} WHERE "id" = $${ENCRYPTED.length + 1}`, [...values, row.id]);
    }
    await q.query(`DROP INDEX "public"."IDX_296118db7e4c0727bff2ae9992"`);
    await q.query(`ALTER TABLE "employees" DROP COLUMN "rnokppHash"`);
    await q.query(`ALTER TABLE "employees" ALTER COLUMN "militaryDocNumber" TYPE character varying(50)`);
    await q.query(`ALTER TABLE "employees" ALTER COLUMN "registryNumber" TYPE character varying(50)`);
    await q.query(`ALTER TABLE "employees" ALTER COLUMN "foreignPassportNumber" TYPE character varying(20)`);
    await q.query(`ALTER TABLE "employees" ALTER COLUMN "passportNumber" TYPE character varying(20)`);
    await q.query(`ALTER TABLE "employees" ALTER COLUMN "rnokpp" TYPE character varying(20)`);
    await q.query(`CREATE INDEX "IDX_65fbfbc9d07b4e4fcbcfd1ed68" ON "employees" ("rnokpp")`);
    for (const col of ['lastLoginAt', 'passwordChangedAt', 'mustChangePassword', 'lockedUntil', 'failedLoginCount', 'tokenVersion']) {
      await q.query(`ALTER TABLE "users" DROP COLUMN "${col}"`);
    }
  }
}

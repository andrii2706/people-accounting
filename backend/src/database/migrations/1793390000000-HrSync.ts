import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Employees from 1C (ЗУП / BAS): the settings of a legal entity, the deliveries (encrypted) and the reference
 * of the person in 1C on our card — the most reliable way to recognise him next time.
 */
export class HrSync1793390000000 implements MigrationInterface {
  name = 'HrSync1793390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hr_sync_settings" (
        "legalEntityId" uuid PRIMARY KEY REFERENCES "legal_entities"("id") ON DELETE CASCADE,
        "system" varchar(20) NOT NULL DEFAULT 'ZUP',
        "mode" varchar(10) NOT NULL DEFAULT 'PUSH',
        "odataUrl" varchar(500) NOT NULL DEFAULT '',
        "odataUser" varchar(100) NOT NULL DEFAULT '',
        "odataPassword" text NOT NULL DEFAULT '',
        "organizationCode" varchar(10) NOT NULL DEFAULT '',
        "scheduleEnabled" boolean NOT NULL DEFAULT false,
        "scheduleHour" int NOT NULL DEFAULT 6,
        "autoApply" boolean NOT NULL DEFAULT true,
        "militaryPolicy" varchar(12) NOT NULL DEFAULT 'FILL_EMPTY',
        "importDismissed" boolean NOT NULL DEFAULT false,
        "tokenHash" varchar(64) NOT NULL DEFAULT '',
        "tokenPrefix" varchar(20) NOT NULL DEFAULT '',
        "tokenIssuedAt" timestamptz,
        "configuredById" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "configuredBy" varchar(200) NOT NULL DEFAULT '',
        "lastRunAt" timestamptz,
        "lastStatus" varchar(12),
        "lastMessage" varchar(500) NOT NULL DEFAULT '',
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_hr_sync_settings_token" ON "hr_sync_settings" ("tokenPrefix") WHERE "tokenPrefix" <> ''`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hr_sync_batches" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "legalEntityId" uuid NOT NULL REFERENCES "legal_entities"("id") ON DELETE CASCADE,
        "source" varchar(16) NOT NULL,
        "system" varchar(20) NOT NULL,
        "status" varchar(12) NOT NULL DEFAULT 'PENDING',
        "payload" text NOT NULL,
        "items" text NOT NULL,
        "counts" jsonb NOT NULL,
        "message" varchar(500) NOT NULL DEFAULT '',
        "receivedAt" timestamptz NOT NULL DEFAULT now(),
        "appliedAt" timestamptz,
        "appliedBy" varchar(200) NOT NULL DEFAULT ''
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_hr_sync_batches_entity" ON "hr_sync_batches" ("legalEntityId", "receivedAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "externalId" varchar(64) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employees_external" ON "employees" ("legalEntityId", "externalId") WHERE "externalId" <> ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_employees_external"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN IF EXISTS "externalId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hr_sync_batches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hr_sync_settings"`);
  }
}

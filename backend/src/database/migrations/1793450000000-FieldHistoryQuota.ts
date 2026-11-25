import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 24.11.2026: dates of the changes of contacts, addresses, the passport and the TCK (employee_field_history);
 * recalculations of the reservation quota and its e-mails (quota_recalculations, legal_entities.quota*).
 */
export class FieldHistoryQuota1793450000000 implements MigrationInterface {
  name = 'FieldHistoryQuota1793450000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "employee_field_history" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "employeeId" uuid NOT NULL,
      "field" varchar(30) NOT NULL,
      "oldValue" text NOT NULL DEFAULT '',
      "newValue" text NOT NULL DEFAULT '',
      "effectiveDate" date NOT NULL,
      "oldEffectiveDate" date,
      "basis" text NOT NULL DEFAULT '',
      "createdById" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_employee_field_history" PRIMARY KEY ("id"),
      CONSTRAINT "FK_employee_field_history_employee" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE
    )`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employee_field_history_lookup" ON "employee_field_history" ("employeeId", "field", "effectiveDate")`,
    );
    await q.query(`CREATE TABLE IF NOT EXISTS "quota_recalculations" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "legalEntityId" uuid NOT NULL,
      "reason" varchar(300) NOT NULL DEFAULT '',
      "percent" numeric(5,2),
      "base" int NOT NULL,
      "quota" int,
      "reservedCompany" int NOT NULL,
      "available" int,
      "exceeded" boolean NOT NULL DEFAULT false,
      "prevBase" int,
      "prevQuota" int,
      "prevReserved" int,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_quota_recalculations" PRIMARY KEY ("id"),
      CONSTRAINT "FK_quota_recalculations_entity" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE
    )`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_quota_recalculations_entity" ON "quota_recalculations" ("legalEntityId", "createdAt")`,
    );
    await q.query(`ALTER TABLE "legal_entities"
      ADD COLUMN IF NOT EXISTS "quotaNotifyExceeded" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "quotaNotifyDecreased" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "quotaNotifyExpiring" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "quotaExceededNotified" int`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "legal_entities"
      DROP COLUMN IF EXISTS "quotaNotifyExceeded", DROP COLUMN IF EXISTS "quotaNotifyDecreased",
      DROP COLUMN IF EXISTS "quotaNotifyExpiring", DROP COLUMN IF EXISTS "quotaExceededNotified"`);
    await q.query(`DROP TABLE IF EXISTS "quota_recalculations"`);
    await q.query(`DROP TABLE IF EXISTS "employee_field_history"`);
  }
}

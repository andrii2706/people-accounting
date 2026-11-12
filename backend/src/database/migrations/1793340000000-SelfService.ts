import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Self sign-up and subscriptions: who signed up himself and which agreement he accepted, legal entities that work
 * by subscription, the vendor's prices and requisites, subscriptions and invoices; own databases of the legal
 * entities (stage 1 — the connection); the mobilization term extended by 90 days while the decree is awaited.
 */
export class SelfService1793340000000 implements MigrationInterface {
  name = 'SelfService1793340000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signupSource" varchar(10) NOT NULL DEFAULT 'ADMIN'`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsVersion" varchar(20)`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" timestamptz`);

    await q.query(
      `ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "billingRequired" boolean NOT NULL DEFAULT false`,
    );

    await q.query(`ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "mobilizationConfirmedUntil" date`);
    await q.query(
      `ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "mobilizationEstimated" boolean NOT NULL DEFAULT false`,
    );
    await q.query(
      `UPDATE "organization" SET "mobilizationConfirmedUntil" = "mobilizationUntil" WHERE "mobilizationConfirmedUntil" IS NULL`,
    );

    await q.query(`
      CREATE TABLE IF NOT EXISTS "billing_settings" (
        "id" int PRIMARY KEY,
        "seller" jsonb,
        "monthlyPrice" numeric(12,2),
        "yearlyPrice" numeric(12,2),
        "enterpriseText" varchar(1000) NOT NULL DEFAULT '',
        "serviceName" varchar(300) NOT NULL DEFAULT '',
        "invoicePrefix" varchar(20) NOT NULL DEFAULT '',
        "dueDays" int NOT NULL DEFAULT 5,
        "trialDays" int NOT NULL DEFAULT 14,
        "updatedBy" varchar(200) NOT NULL DEFAULT '',
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "legalEntityId" uuid NOT NULL REFERENCES "legal_entities"("id") ON DELETE CASCADE,
        "ownerUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "plan" varchar(20) NOT NULL,
        "trialUntil" date NOT NULL,
        "paidUntil" date,
        "enterpriseRequestedAt" timestamptz,
        "enterpriseNote" varchar(1000) NOT NULL DEFAULT '',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_subscriptions_entity" ON "subscriptions" ("legalEntityId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "year" int NOT NULL,
        "sequence" int NOT NULL,
        "number" varchar(40) NOT NULL UNIQUE,
        "subscriptionId" uuid REFERENCES "subscriptions"("id") ON DELETE SET NULL,
        "legalEntityId" uuid REFERENCES "legal_entities"("id") ON DELETE SET NULL,
        "plan" varchar(20) NOT NULL,
        "periodFrom" date NOT NULL,
        "periodTo" date NOT NULL,
        "description" varchar(500) NOT NULL,
        "net" numeric(12,2) NOT NULL,
        "vatAmount" numeric(12,2) NOT NULL,
        "total" numeric(12,2) NOT NULL,
        "issuedAt" date NOT NULL,
        "dueDate" date NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'ISSUED',
        "paidAt" date,
        "seller" jsonb NOT NULL,
        "buyer" jsonb NOT NULL,
        "createdBy" varchar(200) NOT NULL DEFAULT '',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoices_year_sequence" ON "invoices" ("year", "sequence")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_subscription" ON "invoices" ("subscriptionId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "entity_databases" (
        "legalEntityId" uuid PRIMARY KEY REFERENCES "legal_entities"("id") ON DELETE CASCADE,
        "host" varchar(255) NOT NULL,
        "port" int NOT NULL DEFAULT 5432,
        "database" varchar(63) NOT NULL,
        "username" varchar(63) NOT NULL,
        "password" text NOT NULL,
        "sslMode" varchar(20) NOT NULL DEFAULT 'require',
        "status" varchar(20) NOT NULL DEFAULT 'NEW',
        "lastCheckedAt" timestamptz,
        "lastError" varchar(500) NOT NULL DEFAULT '',
        "serverVersion" varchar(200) NOT NULL DEFAULT '',
        "canCreate" boolean NOT NULL DEFAULT false,
        "updatedBy" varchar(200) NOT NULL DEFAULT '',
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "entity_databases"`);
    await q.query(`DROP TABLE IF EXISTS "invoices"`);
    await q.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await q.query(`DROP TABLE IF EXISTS "billing_settings"`);
    await q.query(`ALTER TABLE "organization" DROP COLUMN IF EXISTS "mobilizationEstimated"`);
    await q.query(`ALTER TABLE "organization" DROP COLUMN IF EXISTS "mobilizationConfirmedUntil"`);
    await q.query(`ALTER TABLE "legal_entities" DROP COLUMN IF EXISTS "billingRequired"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "termsAcceptedAt"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "termsVersion"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "signupSource"`);
  }
}

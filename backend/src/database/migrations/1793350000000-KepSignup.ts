import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sign-up of a company by its head with KEP (the statements, approved and refused); the offer accepted per legal
 * entity with the head's KEP instead of a click of every user; the criticality document of the reservation quota
 * (name, authority, date, number, valid until).
 */
export class KepSignup1793350000000 implements MigrationInterface {
  name = 'KepSignup1793350000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "signup_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "edrpou" varchar(10) NOT NULL,
        "email" varchar(254) NOT NULL,
        "document" text NOT NULL,
        "documentSha256" varchar(64) NOT NULL,
        "status" varchar(12) NOT NULL DEFAULT 'PENDING',
        "reason" varchar(30),
        "reasonText" varchar(500) NOT NULL DEFAULT '',
        "signerName" varchar(300) NOT NULL DEFAULT '',
        "signerDrfoMasked" varchar(20) NOT NULL DEFAULT '',
        "signerEdrpou" varchar(10) NOT NULL DEFAULT '',
        "signerIssuer" varchar(500) NOT NULL DEFAULT '',
        "registryHeadName" varchar(300) NOT NULL DEFAULT '',
        "kepLevel" varchar(10),
        "signatureKey" varchar(300),
        "ip" varchar(64) NOT NULL DEFAULT '',
        "legalEntityId" uuid,
        "userId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "expiresAt" timestamptz NOT NULL,
        "completedAt" timestamptz
      )`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_signup_requests_status_created" ON "signup_requests" ("status", "createdAt")`,
    );

    await q.query(`ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "offerVersion" varchar(20)`);
    await q.query(`ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "offerSignedAt" timestamptz`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "offer_signatures" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "legalEntityId" uuid NOT NULL REFERENCES "legal_entities"("id") ON DELETE CASCADE,
        "termsVersion" varchar(20) NOT NULL,
        "document" text NOT NULL,
        "documentSha256" varchar(64) NOT NULL,
        "status" varchar(10) NOT NULL DEFAULT 'PENDING',
        "signerName" varchar(300) NOT NULL DEFAULT '',
        "signerDrfoMasked" varchar(20) NOT NULL DEFAULT '',
        "signerIssuer" varchar(500) NOT NULL DEFAULT '',
        "kepLevel" varchar(10),
        "signatureKey" varchar(300),
        "requestedByUserId" uuid,
        "signedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "signedAt" timestamptz
      )`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_offer_signatures_entity_version" ON "offer_signatures" ("legalEntityId", "termsVersion")`,
    );
    // the click «Ознайомився та приймаю» of every user is replaced by the head's KEP per legal entity
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "termsAcceptedAt"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "termsVersion"`);

    // the basis of the quota becomes the name of the criticality document
    await q.query(`ALTER TABLE "legal_entities" RENAME COLUMN "reservationQuotaBasis" TO "reservationQuotaDocName"`);
    await q.query(
      `ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "reservationQuotaAuthority" varchar(300) NOT NULL DEFAULT ''`,
    );
    await q.query(`ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "reservationQuotaDocDate" date`);
    await q.query(
      `ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "reservationQuotaDocNumber" varchar(100) NOT NULL DEFAULT ''`,
    );
    await q.query(`ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "reservationQuotaValidUntil" date`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "legal_entities" DROP COLUMN IF EXISTS "reservationQuotaValidUntil"`);
    await q.query(`ALTER TABLE "legal_entities" DROP COLUMN IF EXISTS "reservationQuotaDocNumber"`);
    await q.query(`ALTER TABLE "legal_entities" DROP COLUMN IF EXISTS "reservationQuotaDocDate"`);
    await q.query(`ALTER TABLE "legal_entities" DROP COLUMN IF EXISTS "reservationQuotaAuthority"`);
    await q.query(`ALTER TABLE "legal_entities" RENAME COLUMN "reservationQuotaDocName" TO "reservationQuotaBasis"`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsVersion" varchar(20)`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" timestamptz`);
    await q.query(`DROP TABLE IF EXISTS "offer_signatures"`);
    await q.query(`ALTER TABLE "legal_entities" DROP COLUMN IF EXISTS "offerSignedAt"`);
    await q.query(`ALTER TABLE "legal_entities" DROP COLUMN IF EXISTS "offerVersion"`);
    await q.query(`DROP TABLE IF EXISTS "signup_requests"`);
  }
}

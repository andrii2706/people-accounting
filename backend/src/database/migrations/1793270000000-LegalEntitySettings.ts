import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The reservation quota and the extra e-mail addresses for reminders belong to a legal entity now:
 * every entity gets the values that were in the system settings (the old columns stay, unused).
 * The head gets a link to his user account (access to the system), like the responsible person.
 */
export class LegalEntitySettings1793270000000 implements MigrationInterface {
  name = 'LegalEntitySettings1793270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "legal_entities" ADD "reservationQuota" integer`);
    await queryRunner.query(
      `ALTER TABLE "legal_entities" ADD "reservationQuotaBasis" character varying(300) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "legal_entities" ADD "notifyEmails" character varying(500) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(`ALTER TABLE "legal_entities" ADD "headUserId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "legal_entities" ADD CONSTRAINT "FK_legal_entities_head_user" FOREIGN KEY ("headUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`
      UPDATE "legal_entities" e
      SET "reservationQuota" = o."reservationQuota",
          "reservationQuotaBasis" = COALESCE(o."reservationQuotaBasis", ''),
          "notifyEmails" = COALESCE(o."notifyEmails", '')
      FROM "organization" o WHERE o."id" = 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "legal_entities" DROP CONSTRAINT "FK_legal_entities_head_user"`);
    await queryRunner.query(`ALTER TABLE "legal_entities" DROP COLUMN "headUserId"`);
    await queryRunner.query(`ALTER TABLE "legal_entities" DROP COLUMN "notifyEmails"`);
    await queryRunner.query(`ALTER TABLE "legal_entities" DROP COLUMN "reservationQuotaBasis"`);
    await queryRunner.query(`ALTER TABLE "legal_entities" DROP COLUMN "reservationQuota"`);
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The reservation quota of a legal entity is now a percent (places = percent × working military-liable men).
 * The old value was a number of places and cannot be turned into a percent — it is cleared and has to be
 * entered again in percent.
 */
export class QuotaPercent1793300000000 implements MigrationInterface {
  name = 'QuotaPercent1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "legal_entities" ADD "reservationQuotaPercent" numeric(5,2)`);
    await queryRunner.query(`ALTER TABLE "legal_entities" DROP COLUMN "reservationQuota"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "legal_entities" ADD "reservationQuota" integer`);
    await queryRunner.query(`ALTER TABLE "legal_entities" DROP COLUMN "reservationQuotaPercent"`);
  }
}

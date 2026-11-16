import type { MigrationInterface, QueryRunner } from 'typeorm';

/** A part-timer with a deferral can be left out of the reservation quota base («за сумісництвом»). */
export class PartTimeQuota1793370000000 implements MigrationInterface {
  name = 'PartTimeQuota1793370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "partTimeNotInQuota" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN IF EXISTS "partTimeNotInQuota"`);
  }
}

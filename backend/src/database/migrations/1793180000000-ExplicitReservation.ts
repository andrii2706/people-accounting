import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Заброньований" becomes an explicit choice in the employee form.
 * Employees whose reservation data was already filled in keep it (reserved = true).
 */
export class ExplicitReservation1793180000000 implements MigrationInterface {
  name = 'ExplicitReservation1793180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" ADD "reserved" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(
      `UPDATE "employees" SET "reserved" = true
       WHERE "reservationBasis" <> '' OR "specialAccountingCertificate" <> '' OR "reservationUntil" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "reserved"`);
  }
}

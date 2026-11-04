import type { MigrationInterface, QueryRunner } from 'typeorm';

/** A temporary password issued by the administrator expires (TEMPORARY_PASSWORD_HOURS, 72 by default). */
export class TemporaryPasswordExpiry1793280000000 implements MigrationInterface {
  name = 'TemporaryPasswordExpiry1793280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "temporaryPasswordExpiresAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "temporaryPasswordExpiresAt"`);
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

/** The letterhead of the letters of each legal entity (null — the defaults: the letterhead from the requisites). */
export class Letterhead1793440000000 implements MigrationInterface {
  name = 'Letterhead1793440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "letterheadSettings" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "legal_entities" DROP COLUMN IF EXISTS "letterheadSettings"`);
  }
}

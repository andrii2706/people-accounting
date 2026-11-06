import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Envelope label settings of each legal entity (null — the defaults, as the labels looked before). */
export class LabelSettings1793330000000 implements MigrationInterface {
  name = 'LabelSettings1793330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "labelSettings" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "legal_entities" DROP COLUMN IF EXISTS "labelSettings"`);
  }
}

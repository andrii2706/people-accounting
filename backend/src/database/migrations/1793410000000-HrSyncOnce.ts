import type { MigrationInterface, QueryRunner } from 'typeorm';

/** 1C: a single initial load (ONCE) besides the daily one; the integrations set up before stay ONGOING. */
export class HrSyncOnce1793410000000 implements MigrationInterface {
  name = 'HrSyncOnce1793410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hr_sync_settings" ADD "frequency" varchar(10) NOT NULL DEFAULT 'ONGOING'`);
    await queryRunner.query(`ALTER TABLE "hr_sync_settings" ADD "completedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "hr_sync_settings" ADD "firstPushAt" timestamptz`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hr_sync_settings" DROP COLUMN "firstPushAt"`);
    await queryRunner.query(`ALTER TABLE "hr_sync_settings" DROP COLUMN "completedAt"`);
    await queryRunner.query(`ALTER TABLE "hr_sync_settings" DROP COLUMN "frequency"`);
  }
}

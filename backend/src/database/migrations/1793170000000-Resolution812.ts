import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Resolution No. 812 of 10.06.2026: changes of the foreign passport, education and marital status
 * are no longer reported to the TCK. Close such changes that are still waiting for a notice.
 */
export class Resolution8121793170000000 implements MigrationInterface {
  name = 'Resolution8121793170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "employee_changes" SET "skipped" = true
       WHERE "letterId" IS NULL AND "skipped" = false AND "type" IN ('FOREIGN_PASSPORT', 'EDUCATION', 'MARITAL_STATUS')`,
    );
  }

  public async down(): Promise<void> {
    // Data-only migration: which changes were open before cannot be restored.
  }
}

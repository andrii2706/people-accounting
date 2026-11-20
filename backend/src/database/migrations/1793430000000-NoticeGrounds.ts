import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The TCK is notified only about the grounds of Annex 4 (since 27.06.2026): the name, the passport, the addresses,
 * the position, the hiring and the dismissal. Changes of the military data still waiting in the queue
 * (rank, VOS, the document, the TCK, fitness, deferral, reservation…) are marked «not needed» — nothing is deleted,
 * the history of the employee keeps them.
 */
export class NoticeGrounds1793430000000 implements MigrationInterface {
  name = 'NoticeGrounds1793430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "employee_changes" SET "skipped" = true
       WHERE "letterId" IS NULL AND "skipped" = false
         AND "type" NOT IN ('LAST_NAME', 'FIRST_NAME', 'MIDDLE_NAME', 'POSITION', 'REGISTERED_ADDRESS',
                            'ACTUAL_ADDRESS', 'PASSPORT', 'HIRE', 'DISMISSAL', 'DATA')`,
    );
  }

  public async down(): Promise<void> {
    // which of the skipped changes were skipped by this migration is not known — nothing to undo
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ALL_TCK } from '../tck-directory.js';

/**
 * Postal codes of the TCK that had none (index of the street address, checked house by house).
 * Only empty codes are filled — codes entered by hand stay as they are.
 */
export class TckPostalCodes1793310000000 implements MigrationInterface {
  name = 'TckPostalCodes1793310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const t of ALL_TCK.filter((x) => x.postalCode)) {
      await queryRunner.query(`UPDATE "tck" SET "postalCode" = $2 WHERE "name" = $1 AND "postalCode" = ''`, [
        t.name,
        t.postalCode,
      ]);
    }
  }

  public async down(): Promise<void> {
    // the codes stay: envelopes and labels may already use them
  }
}

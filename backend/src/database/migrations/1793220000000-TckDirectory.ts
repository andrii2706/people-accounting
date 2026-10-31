import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ALL_TCK } from '../tck-directory.js';

/**
 * Fills the TCK directory (Lviv region + all other regions of Ukraine).
 * Previously it was filled only by `npm run seed`, so a fresh database (local or production) had an empty list.
 * Only missing entries are added (by name) — existing ones and manual edits stay as they are.
 */
export class TckDirectory1793220000000 implements MigrationInterface {
  name = 'TckDirectory1793220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const t of ALL_TCK) {
      await queryRunner.query(
        `INSERT INTO "tck" ("name", "nameGenitive", "address", "postalCode", "phone", "email")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("name") DO NOTHING`,
        [t.name, t.nameGenitive, t.address, t.postalCode, t.phone, t.email],
      );
    }
  }

  public async down(): Promise<void> {
    // nothing is removed: employees may already refer to these TCK
  }
}

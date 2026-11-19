import type { MigrationInterface, QueryRunner } from 'typeorm';
import { tckPlace } from '../../dictionaries/utils/tck-place.utils.js';
import { ALL_TCK } from '../tck-directory.js';

/**
 * Region, district and town of every TCK — the filters of the directory.
 * Filled from the directory data (the region is known for every seeded TCK) or from the name and the address;
 * entries added by hand get them the same way.
 */
export class TckPlace1793400000000 implements MigrationInterface {
  name = 'TckPlace1793400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tck" ADD "region" varchar(100) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "tck" ADD "district" varchar(100) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "tck" ADD "city" varchar(100) NOT NULL DEFAULT ''`);

    const known = new Map(ALL_TCK.map((t) => [t.name, t]));
    const rows = (await queryRunner.query(`SELECT "id", "name", "address" FROM "tck"`)) as {
      id: string;
      name: string;
      address: string;
    }[];
    for (const row of rows) {
      const seeded = known.get(row.name);
      const place = tckPlace(row, seeded?.region ?? '');
      await queryRunner.query(`UPDATE "tck" SET "region" = $2, "district" = $3, "city" = $4 WHERE "id" = $1`, [
        row.id,
        place.region,
        place.district,
        place.city,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tck" DROP COLUMN "city"`);
    await queryRunner.query(`ALTER TABLE "tck" DROP COLUMN "district"`);
    await queryRunner.query(`ALTER TABLE "tck" DROP COLUMN "region"`);
  }
}

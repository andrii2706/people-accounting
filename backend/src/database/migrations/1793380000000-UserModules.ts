import type { MigrationInterface, QueryRunner } from 'typeorm';

/** The applications an account may open (portal: oblik, kadry, docs); everyone keeps «Військовий облік». */
export class UserModules1793380000000 implements MigrationInterface {
  name = 'UserModules1793380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "modules" text NOT NULL DEFAULT 'oblik'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "modules"`);
  }
}

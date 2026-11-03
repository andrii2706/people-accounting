import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Date of the next military medical commission (ВЛК) — for employees with a deferral. */
export class NextVlk1793230000000 implements MigrationInterface {
  name = 'NextVlk1793230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" ADD "nextVlkDate" date`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "nextVlkDate"`);
  }
}

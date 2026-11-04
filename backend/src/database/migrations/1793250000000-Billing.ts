import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Debt for using the system: the status (one row) and the one-time entry of each user. */
export class Billing1793250000000 implements MigrationInterface {
  name = 'Billing1793250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "billing_status" ("id" integer NOT NULL, "hasDebt" boolean NOT NULL DEFAULT false, "amount" numeric(12,2), "debtSince" date, "paymentContact" character varying(300) NOT NULL DEFAULT '', "debtSetAt" TIMESTAMP WITH TIME ZONE, "updatedBy" character varying(200) NOT NULL DEFAULT '', "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_billing_status" PRIMARY KEY ("id"), CONSTRAINT "CHK_billing_status_single" CHECK ("id" = 1))`,
    );
    await queryRunner.query(`INSERT INTO "billing_status" ("id") VALUES (1)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "debtGraceUsedAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "debtGraceUsedAt"`);
    await queryRunner.query(`DROP TABLE "billing_status"`);
  }
}

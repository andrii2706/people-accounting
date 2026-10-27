import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeNoticesAndLabels1793087760861 implements MigrationInterface {
    name = 'ChangeNoticesAndLabels1793087760861'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "change_notices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "letterId" uuid NOT NULL, "sequence" integer NOT NULL, "employeeId" uuid, "changeId" uuid, "employeeName" character varying(300) NOT NULL, "changeType" character varying(30) NOT NULL, "effectiveDate" date NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_89d21221e3c77e3a9bed1f07020" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_193a6643f8749ddb1555d4a4df" ON "change_notices"  ("employeeId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fa1eb9da36cd086149aaa0a64e" ON "change_notices"  ("letterId", "sequence") `);
        await queryRunner.query(`ALTER TABLE "tck" ADD "postalCode" character varying(10) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "postalCode" character varying(10) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "change_notices" ADD CONSTRAINT "FK_160a3cfbb539d364a8e62209b30" FOREIGN KEY ("letterId") REFERENCES "outgoing_letters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "change_notices" ADD CONSTRAINT "FK_193a6643f8749ddb1555d4a4dfe" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "change_notices" ADD CONSTRAINT "FK_b8de64679ead1f43b1cabced8f3" FOREIGN KEY ("changeId") REFERENCES "employee_changes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "change_notices" DROP CONSTRAINT "FK_b8de64679ead1f43b1cabced8f3"`);
        await queryRunner.query(`ALTER TABLE "change_notices" DROP CONSTRAINT "FK_193a6643f8749ddb1555d4a4dfe"`);
        await queryRunner.query(`ALTER TABLE "change_notices" DROP CONSTRAINT "FK_160a3cfbb539d364a8e62209b30"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "postalCode"`);
        await queryRunner.query(`ALTER TABLE "tck" DROP COLUMN "postalCode"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fa1eb9da36cd086149aaa0a64e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_193a6643f8749ddb1555d4a4df"`);
        await queryRunner.query(`DROP TABLE "change_notices"`);
    }

}

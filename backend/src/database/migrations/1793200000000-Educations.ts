import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Several educations per employee: table employee_educations, existing education is copied as the first entry. */
export class Educations1793200000000 implements MigrationInterface {
  name = 'Educations1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "employee_educations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employeeId" uuid NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "level" character varying(100) NOT NULL DEFAULT '', "institution" character varying(300) NOT NULL DEFAULT '', "specialty" character varying(300) NOT NULL DEFAULT '', "document" character varying(300) NOT NULL DEFAULT '', "documentDate" date, CONSTRAINT "PK_employee_educations" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "employee_educations" ADD CONSTRAINT "FK_employee_educations_employee" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`CREATE INDEX "IDX_employee_educations_employee" ON "employee_educations" ("employeeId")`);
    await queryRunner.query(`
      INSERT INTO "employee_educations" ("employeeId", "sortOrder", "level", "specialty", "document", "documentDate")
      SELECT "id", 0, "educationLevel", left("educationSpecialty", 300), left("educationDocument", 300), "educationDocumentDate"
      FROM "employees"
      WHERE "educationLevel" <> '' OR "educationSpecialty" <> '' OR "educationDocument" <> ''`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // the card keeps the highest education in its own fields, so only the extra entries are lost
    await queryRunner.query(`DROP TABLE "employee_educations"`);
  }
}

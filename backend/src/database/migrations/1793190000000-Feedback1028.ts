import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Feedback of 28.10: several military documents per employee (date and time of generation separately),
 * positions history, director history, reservation quota and «by another legal entity», deferral
 * «до завершення мобілізації», served in the army, document names of the hire/dismissal orders,
 * e-mail reminders (notification_log, users.notify), term of mobilization from the decrees.
 * Existing data is moved: the single military document → military_documents, the current position →
 * employee_positions, the head from the company details → organization_heads.
 */

export class Feedback10281793190000000 implements MigrationInterface {
    name = 'Feedback10281793190000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "employee_positions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employeeId" uuid NOT NULL, "position" character varying(300) NOT NULL, "department" character varying(200) NOT NULL DEFAULT '', "since" date, "orderDocName" character varying(100) NOT NULL DEFAULT '', "orderNumber" character varying(50) NOT NULL DEFAULT '', "orderDate" date, CONSTRAINT "PK_8544f049d46ad635c8cb2b9fc0c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "military_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employeeId" uuid NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "type" character varying(150) NOT NULL DEFAULT '', "series" character varying(20) NOT NULL DEFAULT '', "number" text NOT NULL DEFAULT '', "issuedBy" character varying(300) NOT NULL DEFAULT '', "issuedAt" date, "generatedDate" date, "generatedTime" character varying(5) NOT NULL DEFAULT '', CONSTRAINT "PK_162ea7b757cdb4c33a9000c7996" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "notification_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(40) NOT NULL, "refId" uuid NOT NULL, "refDate" date NOT NULL, "recipients" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6f761cfbbd064e0f326960877d6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6fa5f955ae4d6101344c2196b1" ON "notification_log"  ("kind", "refId", "refDate") `);
        await queryRunner.query(`CREATE TABLE "organization_heads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "position" character varying(200) NOT NULL, "fullName" character varying(200) NOT NULL, "orderNumber" character varying(50) NOT NULL DEFAULT '', "validFrom" date NOT NULL, "validTo" date, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_45d6e9b54ae81792b9bf5062c19" PRIMARY KEY ("id"))`);
        // --- data: the single military document → military_documents (the encrypted number is copied as is)
        await queryRunner.query(`
            INSERT INTO "military_documents" ("employeeId", "sortOrder", "type", "series", "number", "issuedBy", "issuedAt", "generatedDate", "generatedTime")
            SELECT "id", 0, "militaryDocType", "militaryDocSeries", "militaryDocNumber", "militaryDocIssuedBy", "militaryDocIssuedAt",
                   CASE WHEN "militaryDocGeneratedAt" ~ '^[0-9]{2}:[0-9]{2} [0-9]{2}[.][0-9]{2}[.][0-9]{4}$'
                        THEN to_date(substring("militaryDocGeneratedAt" from 7), 'DD.MM.YYYY') END,
                   CASE WHEN "militaryDocGeneratedAt" ~ '^[0-9]{2}:[0-9]{2}' THEN substring("militaryDocGeneratedAt" from 1 for 5) ELSE '' END
            FROM "employees"
            WHERE "militaryDocType" <> '' OR "militaryDocNumber" <> '' OR "militaryDocSeries" <> ''`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "militaryDocType"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "militaryDocSeries"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "militaryDocNumber"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "militaryDocIssuedBy"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "militaryDocIssuedAt"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "militaryDocGeneratedAt"`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "hireOrderDocName" character varying(100) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "dismissalOrderDocName" character varying(100) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "servedInArmy" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "reservedBy" character varying(10) NOT NULL DEFAULT 'COMPANY'`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "reservedByName" character varying(300) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "reservedByEdrpou" character varying(10) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "deferralUntilMobilizationEnd" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "reservationQuota" integer`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "reservationQuotaBasis" character varying(300) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "mobilizationUntil" date`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "mobilizationDecree" character varying(300) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "mobilizationSource" character varying(500) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "mobilizationCheckedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "notifyEmails" character varying(500) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "users" ADD "notify" boolean NOT NULL DEFAULT true`);
        // --- data: the current position → the first entry of the positions history
        await queryRunner.query(`
            INSERT INTO "employee_positions" ("employeeId", "position", "department", "since", "orderDocName", "orderNumber", "orderDate")
            SELECT "id", "position", "department", COALESCE("positionSince", "hireDate"),
                   CASE WHEN "positionSince" IS NULL OR "positionSince" = "hireDate" THEN CASE WHEN "hireOrderNumber" <> '' THEN 'наказ' ELSE '' END
                        ELSE left("positionOrder", 100) END,
                   CASE WHEN "positionSince" IS NULL OR "positionSince" = "hireDate" THEN "hireOrderNumber" ELSE '' END,
                   CASE WHEN "positionSince" IS NULL OR "positionSince" = "hireDate" THEN "hireOrderDate" END
            FROM "employees" WHERE "position" <> ''`);
        // --- data: the head from the company details becomes the first period (signs everything until changed)
        await queryRunner.query(`
            INSERT INTO "organization_heads" ("position", "fullName", "validFrom")
            SELECT COALESCE(NULLIF("headPosition", ''), 'Директор'), "headName", DATE '2000-01-01'
            FROM "organization" WHERE "headName" <> ''`);
        await queryRunner.query(`ALTER TABLE "employee_positions" ADD CONSTRAINT "FK_b46bfee47697730d4528a7af8c8" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "military_documents" ADD CONSTRAINT "FK_ca6ed36b53d67e8999415f21bf7" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "military_documents" DROP CONSTRAINT "FK_ca6ed36b53d67e8999415f21bf7"`);
        await queryRunner.query(`ALTER TABLE "employee_positions" DROP CONSTRAINT "FK_b46bfee47697730d4528a7af8c8"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "notify"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "notifyEmails"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "mobilizationCheckedAt"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "mobilizationSource"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "mobilizationDecree"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "mobilizationUntil"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "reservationQuotaBasis"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "reservationQuota"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "deferralUntilMobilizationEnd"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "reservedByEdrpou"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "reservedByName"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "reservedBy"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "servedInArmy"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "dismissalOrderDocName"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "hireOrderDocName"`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "militaryDocGeneratedAt" character varying(30) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "militaryDocIssuedAt" date`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "militaryDocIssuedBy" character varying(300) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "militaryDocNumber" text NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "militaryDocSeries" character varying(20) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "militaryDocType" character varying(150) NOT NULL DEFAULT ''`);
        // the first military document goes back to the employee card
        await queryRunner.query(`
            UPDATE "employees" e SET "militaryDocType" = d."type", "militaryDocSeries" = d."series", "militaryDocNumber" = d."number",
                   "militaryDocIssuedBy" = d."issuedBy", "militaryDocIssuedAt" = d."issuedAt",
                   "militaryDocGeneratedAt" = CASE WHEN d."generatedDate" IS NOT NULL
                       THEN trim(d."generatedTime" || ' ' || to_char(d."generatedDate", 'DD.MM.YYYY')) ELSE '' END
            FROM (SELECT DISTINCT ON ("employeeId") * FROM "military_documents" ORDER BY "employeeId", "sortOrder") d
            WHERE d."employeeId" = e."id"`);
        await queryRunner.query(`DROP TABLE "organization_heads"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6fa5f955ae4d6101344c2196b1"`);
        await queryRunner.query(`DROP TABLE "notification_log"`);
        await queryRunner.query(`DROP TABLE "military_documents"`);
        await queryRunner.query(`DROP TABLE "employee_positions"`);
    }

}

import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Legal entities: the requisites, the current head and the current responsible person of the company move into
 * the first legal entity; all employees and letters are attached to it. Head and responsible-person history
 * tables stay (not used any more) — nothing is lost.
 */
export class LegalEntities1793260000000 implements MigrationInterface {
  name = 'LegalEntities1793260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "legal_entities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying(500) NOT NULL, "nameLocative" character varying(500) NOT NULL DEFAULT '', "shortName" character varying(300) NOT NULL DEFAULT '', "edrpou" character varying(10) NOT NULL, "address" character varying(500) NOT NULL DEFAULT '', "postalCode" character varying(10) NOT NULL DEFAULT '', "phone" character varying(20) NOT NULL DEFAULT '', "email" character varying(200) NOT NULL DEFAULT '', "letterNumberPrefix" character varying(30) NOT NULL DEFAULT '', "headPosition" character varying(200) NOT NULL DEFAULT 'Директор', "headName" character varying(200) NOT NULL DEFAULT '', "responsibleName" character varying(200) NOT NULL DEFAULT '', "responsiblePosition" character varying(200) NOT NULL DEFAULT '', "responsiblePhone" character varying(20) NOT NULL DEFAULT '', "responsibleUserId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_legal_entities_edrpou" UNIQUE ("edrpou"), CONSTRAINT "PK_legal_entities" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "legal_entities" ADD CONSTRAINT "FK_legal_entities_responsible_user" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // the company as it was: requisites + the head and the responsible person in office today
    await queryRunner.query(`
      INSERT INTO "legal_entities" ("fullName", "nameLocative", "shortName", "edrpou", "address", "postalCode",
        "phone", "email", "letterNumberPrefix", "headPosition", "headName",
        "responsibleName", "responsiblePosition", "responsiblePhone")
      SELECT COALESCE(NULLIF(o."fullName", ''), 'Підприємство'), o."nameLocative", o."shortName",
        COALESCE(NULLIF(o."edrpou", ''), '00000000'), o."address", o."postalCode",
        LEFT(regexp_replace(o."phone", '[^0-9+]', '', 'g'), 20), o."email", o."letterNumberPrefix",
        COALESCE(h."position", NULLIF(o."headPosition", ''), 'Директор'), COALESCE(h."fullName", o."headName"),
        COALESCE(r."fullName", ''), COALESCE(r."position", ''),
        LEFT(regexp_replace(COALESCE(r."phone", ''), '[^0-9+]', '', 'g'), 20)
      FROM "organization" o
      LEFT JOIN LATERAL (
        SELECT * FROM "organization_heads"
        WHERE "validFrom" <= CURRENT_DATE AND ("validTo" IS NULL OR "validTo" >= CURRENT_DATE)
        ORDER BY "validFrom" DESC LIMIT 1) h ON true
      LEFT JOIN LATERAL (
        SELECT * FROM "responsible_persons"
        WHERE "validFrom" <= CURRENT_DATE AND ("validTo" IS NULL OR "validTo" >= CURRENT_DATE)
        ORDER BY "validFrom" DESC LIMIT 1) r ON true
      WHERE o."id" = 1 AND (o."fullName" <> '' OR EXISTS (SELECT 1 FROM "employees"))
    `);

    await queryRunner.query(`ALTER TABLE "employees" ADD "legalEntityId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_employees_legal_entity" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_employees_legal_entity" ON "employees" ("legalEntityId")`);
    await queryRunner.query(`ALTER TABLE "outgoing_letters" ADD "legalEntityId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "outgoing_letters" ADD CONSTRAINT "FK_outgoing_letters_legal_entity" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`UPDATE "employees" SET "legalEntityId" = (SELECT "id" FROM "legal_entities" LIMIT 1)`);
    await queryRunner.query(
      `UPDATE "outgoing_letters" SET "legalEntityId" = (SELECT "id" FROM "legal_entities" LIMIT 1)`,
    );

    // phones → «+<country code><digits>» (the same rule as normalizePhone)
    for (const [table, column] of [
      ['employees', 'phone'],
      ['legal_entities', 'phone'],
      ['legal_entities', 'responsiblePhone'],
    ]) {
      const digits = `regexp_replace("${column}", '\\D', '', 'g')`;
      await queryRunner.query(`
        UPDATE "${table}" SET "${column}" = CASE
          WHEN ${digits} ~ '^0[0-9]{9}$' THEN '+38' || ${digits}
          ELSE '+' || ${digits} END
        WHERE "${column}" ~ '^[+0-9 ()-]+$' AND length(${digits}) BETWEEN 7 AND 15`);
    }

    // notices sent before the system: number / date are as on paper, no generated document
    await queryRunner.query(`ALTER TABLE "outgoing_letters" ADD "external" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "outgoing_letters" DROP COLUMN "external"`);
    await queryRunner.query(`ALTER TABLE "outgoing_letters" DROP CONSTRAINT "FK_outgoing_letters_legal_entity"`);
    await queryRunner.query(`ALTER TABLE "outgoing_letters" DROP COLUMN "legalEntityId"`);
    await queryRunner.query(`DROP INDEX "IDX_employees_legal_entity"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_employees_legal_entity"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "legalEntityId"`);
    await queryRunner.query(`DROP TABLE "legal_entities"`);
  }
}

import { MigrationInterface, QueryRunner } from "typeorm";

export class LetterSignatures1793023451169 implements MigrationInterface {
    name = 'LetterSignatures1793023451169'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "letter_signatures" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "letterId" uuid NOT NULL, "documentSha256" character varying(64) NOT NULL, "fileKey" character varying(500) NOT NULL, "fileSha256" character varying(64) NOT NULL, "fileSize" integer NOT NULL, "method" character varying(20) NOT NULL, "verification" character varying(20) NOT NULL, "signers" jsonb NOT NULL DEFAULT '[]', "uploadedById" uuid, "uploadedByName" character varying(300) NOT NULL DEFAULT '', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_10a0555e010f2dbca77b2382395" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7f55da164e3526502944a64448" ON "letter_signatures"  ("letterId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_234eba42fff62015ccc08f1e1e" ON "letter_signatures"  ("letterId", "fileSha256") `);
        await queryRunner.query(`ALTER TABLE "outgoing_letters" ADD "documentKey" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "outgoing_letters" ADD "documentSha256" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "outgoing_letters" ADD "documentFilename" character varying(300)`);
        await queryRunner.query(`ALTER TABLE "outgoing_letters" ADD "documentFrozenAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "letter_signatures" ADD CONSTRAINT "FK_7f55da164e3526502944a644485" FOREIGN KEY ("letterId") REFERENCES "outgoing_letters"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        // Підписи лише додаються: заборона UPDATE/DELETE на рівні БД (навіть з обходом застосунку)
        await queryRunner.query(`CREATE FUNCTION letter_signatures_append_only() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'letter_signatures: записи підписів незмінні'; END $$ LANGUAGE plpgsql`);
        await queryRunner.query(`CREATE TRIGGER letter_signatures_append_only BEFORE UPDATE OR DELETE ON "letter_signatures" FOR EACH ROW EXECUTE FUNCTION letter_signatures_append_only()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER letter_signatures_append_only ON "letter_signatures"`);
        await queryRunner.query(`DROP FUNCTION letter_signatures_append_only()`);
        await queryRunner.query(`ALTER TABLE "letter_signatures" DROP CONSTRAINT "FK_7f55da164e3526502944a644485"`);
        await queryRunner.query(`ALTER TABLE "outgoing_letters" DROP COLUMN "documentFrozenAt"`);
        await queryRunner.query(`ALTER TABLE "outgoing_letters" DROP COLUMN "documentFilename"`);
        await queryRunner.query(`ALTER TABLE "outgoing_letters" DROP COLUMN "documentSha256"`);
        await queryRunner.query(`ALTER TABLE "outgoing_letters" DROP COLUMN "documentKey"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_234eba42fff62015ccc08f1e1e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f55da164e3526502944a64448"`);
        await queryRunner.query(`DROP TABLE "letter_signatures"`);
    }

}

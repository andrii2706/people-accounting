import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveEmailSending1793078492274 implements MigrationInterface {
    name = 'RemoveEmailSending1793078492274'

    /** E-mailing letters to the TCK was removed: a letter is handed over outside the system and marked "Надіслано". */
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "outgoing_letters" SET "status" = 'DRAFT' WHERE "status" = 'FAILED'`);
        await queryRunner.query(`ALTER TABLE "outgoing_letters" DROP COLUMN "recipientEmail"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "email_log"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "outgoing_letters" ADD "recipientEmail" character varying(200) NOT NULL DEFAULT ''`);
        await queryRunner.query(`CREATE TABLE "email_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "letterId" uuid, "to" character varying(500) NOT NULL, "subject" character varying(500) NOT NULL, "attachments" jsonb NOT NULL DEFAULT '[]', "status" character varying(20) NOT NULL, "messageId" character varying(300) NOT NULL DEFAULT '', "error" text NOT NULL DEFAULT '', "sentById" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_edfd3f7225051fc07bdd63a22dc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ef644071398addc1eb2f80eddd" ON "email_log"  ("letterId") `);
    }

}

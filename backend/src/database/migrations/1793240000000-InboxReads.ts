import type { MigrationInterface, QueryRunner } from 'typeorm';

/** In-app notifications: «read» marks per user (the notifications themselves are computed). */
export class InboxReads1793240000000 implements MigrationInterface {
  name = 'InboxReads1793240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "inbox_reads" ("userId" uuid NOT NULL, "key" character varying(200) NOT NULL, "readAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_inbox_reads" PRIMARY KEY ("userId", "key"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "inbox_reads" ADD CONSTRAINT "FK_inbox_reads_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "inbox_reads"`);
  }
}

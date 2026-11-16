import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lists are formed on demand («Сформувати») and kept as they were; each legal entity sets how its
 * four lists look (columns, order, grouping, header, signers, own Word template).
 */
export class ListSnapshots1793360000000 implements MigrationInterface {
  name = 'ListSnapshots1793360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "listSettings" jsonb`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "list_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "legalEntityId" uuid NOT NULL,
        "date" date NOT NULL,
        "rows" jsonb NOT NULL,
        "total" integer NOT NULL,
        "sections" jsonb NOT NULL,
        "createdById" uuid,
        "createdByName" character varying(200) NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_list_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "FK_list_snapshots_legal_entity" FOREIGN KEY ("legalEntityId")
          REFERENCES "legal_entities"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_list_snapshots_entity_created" ON "list_snapshots" ("legalEntityId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "list_snapshots"`);
    await queryRunner.query(`ALTER TABLE "legal_entities" DROP COLUMN IF EXISTS "listSettings"`);
  }
}

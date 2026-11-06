import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Roles per legal entity: every account except the main administrator belongs to one legal entity
 * and sees only its data.
 *  - users."legalEntityId" — the account's legal entity;
 *  - the head / responsible person accounts get the legal entity they are linked to;
 *  - when there is only one legal entity, every other account (HR / director) gets it;
 *  - the rest stay unassigned — the main administrator assigns them on the Users page.
 */
export class EntityRoles1793320000000 implements MigrationInterface {
  name = 'EntityRoles1793320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "legalEntityId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_legal_entity" FOREIGN KEY ("legalEntityId")
       REFERENCES "legal_entities"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_users_legal_entity" ON "users" ("legalEntityId")`);

    // every legal entity keeps its own register of outgoing letters (numbers do not reveal the others' letters)
    await queryRunner.query(`DROP INDEX "IDX_63f7a3dd6899c47e9385838232"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_outgoing_letters_entity_number" ON "outgoing_letters"
       (COALESCE("legalEntityId", '00000000-0000-0000-0000-000000000000'::uuid), "year", "sequence")`,
    );

    // head and responsible person accounts: the legal entity they run (the oldest one if linked to several)
    await queryRunner.query(`
      UPDATE "users" u SET "legalEntityId" = le.id
      FROM (
        SELECT DISTINCT ON (user_id) user_id, id FROM (
          SELECT "headUserId" AS user_id, id, "createdAt" FROM "legal_entities" WHERE "headUserId" IS NOT NULL
          UNION ALL
          SELECT "responsibleUserId", id, "createdAt" FROM "legal_entities" WHERE "responsibleUserId" IS NOT NULL
        ) links ORDER BY user_id, "createdAt"
      ) le
      WHERE u.id = le.user_id AND u.role NOT IN ('ADMIN', 'VENDOR')`);

    // a single legal entity — the other accounts belong to it
    await queryRunner.query(`
      UPDATE "users" SET "legalEntityId" = (SELECT id FROM "legal_entities")
      WHERE "legalEntityId" IS NULL AND role NOT IN ('ADMIN', 'VENDOR')
        AND (SELECT count(*) FROM "legal_entities") = 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET role = 'ADMIN' WHERE role = 'ENTITY_ADMIN'`);
    await queryRunner.query(`DROP INDEX "IDX_outgoing_letters_entity_number"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_63f7a3dd6899c47e9385838232" ON "outgoing_letters" ("year", "sequence")`,
    );
    await queryRunner.query(`DROP INDEX "IDX_users_legal_entity"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_legal_entity"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "legalEntityId"`);
  }
}

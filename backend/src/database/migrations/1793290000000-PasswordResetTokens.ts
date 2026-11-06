import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Links to set a new password (password expiry reminders, administrator's requests).
 * The half-year password age of existing accounts starts from now if the change date is unknown.
 */
export class PasswordResetTokens1793290000000 implements MigrationInterface {
  name = 'PasswordResetTokens1793290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying(64) NOT NULL, "purpose" character varying(20) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_password_reset_tokens_user" ON "password_reset_tokens" ("userId")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_password_reset_tokens_hash" ON "password_reset_tokens" ("tokenHash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_password_reset_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`UPDATE "users" SET "passwordChangedAt" = now() WHERE "passwordChangedAt" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
  }
}

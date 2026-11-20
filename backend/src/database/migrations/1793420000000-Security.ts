import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Protection against break-ins: the code from an authenticator app at sign-in, the security journal
 * (suspicious events with e-mail alerts), the known devices of each account, the count of downloaded files
 * (a limit per hour / day), and for 1C — the allowed addresses and the end of the key.
 */
export class Security1793420000000 implements MigrationInterface {
  name = 'Security1793420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "mfaSecret" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD "mfaEnabledAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "users" ADD "mfaRecoveryHashes" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE "users" ADD "mfaLastStep" integer`);
    await queryRunner.query(`ALTER TABLE "users" ADD "mfaFailedCount" integer NOT NULL DEFAULT 0`);

    await queryRunner.query(`
      CREATE TABLE "security_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kind" varchar(30) NOT NULL,
        "level" varchar(10) NOT NULL DEFAULT 'WARN',
        "userId" uuid,
        "userName" varchar(200) NOT NULL DEFAULT '',
        "legalEntityId" uuid,
        "ip" varchar(64) NOT NULL DEFAULT '',
        "device" varchar(120) NOT NULL DEFAULT '',
        "details" jsonb NOT NULL DEFAULT '{}',
        "notified" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_security_events" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_security_events_entity" ON "security_events" ("legalEntityId", "createdAt")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_security_events_kind" ON "security_events" ("kind", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_user" ON "security_events" ("userId", "createdAt")`);

    await queryRunner.query(`
      CREATE TABLE "user_devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "deviceHash" varchar(64) NOT NULL,
        "label" varchar(120) NOT NULL DEFAULT '',
        "lastIp" varchar(64) NOT NULL DEFAULT '',
        "firstSeenAt" timestamptz NOT NULL DEFAULT now(),
        "lastSeenAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_devices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_devices_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_devices_user_hash" ON "user_devices" ("userId", "deviceHash")`,
    );

    await queryRunner.query(`
      CREATE TABLE "export_usage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "legalEntityId" uuid,
        "path" varchar(200) NOT NULL DEFAULT '',
        "fileName" varchar(200) NOT NULL DEFAULT '',
        "bytes" integer NOT NULL DEFAULT 0,
        "sha256" varchar(64) NOT NULL DEFAULT '',
        "ip" varchar(64) NOT NULL DEFAULT '',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_export_usage" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_export_usage_user" ON "export_usage" ("userId", "createdAt")`);
    // «who downloaded this file» — by the hash of a file that turned up somewhere
    await queryRunner.query(`CREATE INDEX "IDX_export_usage_sha256" ON "export_usage" ("sha256")`);

    // «how many cards did this account open in the last hour» — without a full scan of the journal
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_user_action" ON "audit_log" ("userId", "action", "createdAt")`,
    );
    // «how many failed sign-ins in the last minutes» — a password-guessing wave across accounts
    await queryRunner.query(`CREATE INDEX "IDX_audit_log_action_time" ON "audit_log" ("action", "createdAt")`);

    await queryRunner.query(`ALTER TABLE "hr_sync_settings" ADD "pushAllowedIps" varchar(500) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "hr_sync_settings" ADD "tokenExpiresAt" timestamptz`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hr_sync_settings" DROP COLUMN "tokenExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "hr_sync_settings" DROP COLUMN "pushAllowedIps"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_log_action_time"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_log_user_action"`);
    await queryRunner.query(`DROP TABLE "export_usage"`);
    await queryRunner.query(`DROP TABLE "user_devices"`);
    await queryRunner.query(`DROP TABLE "security_events"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfaFailedCount"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfaLastStep"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfaRecoveryHashes"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfaEnabledAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfaSecret"`);
  }
}

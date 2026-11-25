import { Logger } from '@nestjs/common';

/**
 * The environment of unit tests: a minimal development configuration with throwaway keys — no real secrets,
 * no real database (services get the in-memory fake from fake-db.ts).
 */
process.env['NODE_ENV'] ??= 'test';
process.env['DATABASE_URL'] ??= 'postgres://test:test@localhost/test';
process.env['JWT_SECRET'] ??= 'test-only-secret-0123456789abcdef-0123';
process.env['DATA_ENCRYPTION_KEY'] ??= Buffer.alloc(32, 1).toString('base64');
process.env['BLIND_INDEX_KEY'] ??= Buffer.alloc(32, 2).toString('base64');
process.env['APP_URL'] ??= 'http://localhost:8400/oblik';

// the services log failures they swallow (mail, registry) — not needed in the test output
Logger.overrideLogger(false);

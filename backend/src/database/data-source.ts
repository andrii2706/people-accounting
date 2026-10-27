/**
 * DataSource for the TypeORM CLI (migrations).
 *   npm run migration:generate -- src/database/migrations/Name
 *   npm run migration:run
 */
import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities.js';
import { MIGRATIONS } from './migrations/index.js';

export function buildDataSourceOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  return {
    type: 'postgres',
    // Cloud SQL via socket: postgres://user:pass@/military?host=/cloudsql/PROJECT:REGION:INSTANCE
    url: env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/military',
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'migrations',
    synchronize: false,
    logging: env.DB_LOGGING === 'true',
  };
}

export default new DataSource(buildDataSourceOptions());

/**
 * Hourly job (Cloud Run Job «military-registry-hr-sync», Cloud Scheduler at :05): reads 1C over OData for the
 * legal entities whose hour it is (Kyiv time). Locally: npm run job:hr-sync
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { HrSyncService, kyivHour } from '../hr-sync/hr-sync.service.js';

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
try {
  const result = await app.get(HrSyncService).runScheduled(kyivHour());
  Logger.log(JSON.stringify(result), 'HrSyncJob');
} finally {
  await app.close();
}

/**
 * Daily job (Cloud Run Job «military-registry-daily», started by Cloud Scheduler):
 * mobilization term from the decrees + e-mail reminders; 1C: old deliveries are deleted and a read that
 * was missed (no hourly job yet) is made. Locally: npm run job:daily
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { HrSyncService } from '../hr-sync/hr-sync.service.js';
import { DailyJobService } from '../notifications/daily-job.service.js';

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
try {
  const result = await app.get(DailyJobService).run();
  Logger.log(JSON.stringify(result), 'DailyJob');
  const sync = app.get(HrSyncService);
  const purged = await sync.purge();
  const missed = await sync.runScheduled();
  Logger.log(JSON.stringify({ hrSyncPurged: purged, hrSyncMissed: missed }), 'DailyJob');
} finally {
  await app.close();
}

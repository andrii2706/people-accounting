/**
 * Daily job (Cloud Run Job «military-registry-daily», started by Cloud Scheduler):
 * mobilization term from the decrees + e-mail reminders. Locally: npm run job:daily
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { DailyJobService } from '../notifications/daily-job.service.js';

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
try {
  const result = await app.get(DailyJobService).run();
  Logger.log(JSON.stringify(result), 'DailyJob');
} finally {
  await app.close();
}

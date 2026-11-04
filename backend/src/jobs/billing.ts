/**
 * Debt for using the system — set by the vendor from the command line (locally or as a Cloud Run Job):
 *
 *   npm run billing -- --status
 *   npm run billing -- --debt [--amount 1500] [--since 2026-11-01] [--contact "+380 67 000 00 00"]
 *   npm run billing -- --clear
 *   npm run billing -- --create-vendor vendor@example.com "Постачальник" ["<пароль>"]
 *
 * The same can be done on the payment page by a vendor account.
 */
import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { generateTemporaryPassword } from '../common/utils/password-policy.utils.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { BillingService } from '../billing/billing.service.js';
import { UsersService } from '../users/users.service.js';
import { parseBillingArgs } from '../billing/utils/billing-cli.utils.js';
import type { HttpErrorLike } from '../shared/interfaces/common.interface.js';

const command = parseBillingArgs(process.argv.slice(2));
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
try {
  const billing = app.get(BillingService);
  switch (command.kind) {
    case 'status':
      break;
    case 'debt':
      await billing.update({ hasDebt: true, ...command.details }, 'CLI');
      break;
    case 'clear':
      await billing.update({ hasDebt: false }, 'CLI');
      break;
    case 'create-vendor': {
      // in Cloud Run the arguments are visible in the execution details — there the password is generated
      const password = command.password ?? generateTemporaryPassword(randomBytes);
      const user = await app.get(UsersService).createVendor(command.email, command.fullName, password);
      console.log(`Створено обліковий запис постачальника ${user.email}`);
      if (!command.password) console.log(`Пароль (показується один раз): ${password}`);
      break;
    }
  }
  console.log(JSON.stringify(await billing.record(), null, 2));
} catch (err) {
  // validation errors carry readable lines («Пароль: …») — print them instead of a stack trace
  const body = (err as HttpErrorLike).response;
  Logger.error([body?.message ?? (err as Error).message].flat().join('\n'), 'Billing');
  process.exitCode = 1;
} finally {
  await app.close();
}

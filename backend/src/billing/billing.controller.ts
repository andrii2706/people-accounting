import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import {
  AllowPendingPasswordChange,
  AllowUnassigned,
  AllowVendor,
  CurrentUser,
  Roles,
} from '../common/decorators/auth.decorators.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import type { BillingRecord, BillingStatus } from '../shared/interfaces/billing.interface.js';
import { UpdateBillingDto } from './billing.dto.js';
import { BillingService } from './billing.service.js';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly audit: AuditService,
  ) {}

  /** For every signed-in user: the block «Ласкаво просимо» / «Є заборгованість» after a sign-in. */
  @AllowVendor()
  @AllowPendingPasswordChange()
  @AllowUnassigned()
  @Get('status')
  status(): Promise<BillingStatus> {
    return this.billing.status();
  }

  /** Vendor page: the full record. */
  @AllowVendor()
  @Roles('VENDOR')
  @Get()
  record(): Promise<BillingRecord> {
    return this.billing.record();
  }

  @AllowVendor()
  @Roles('VENDOR')
  @Put()
  async update(@Body() dto: UpdateBillingDto, @CurrentUser() user: AuthUser): Promise<BillingRecord> {
    const before = await this.billing.record();
    const after = await this.billing.update(dto, user.fullName || user.email);
    await this.audit.log(
      'billing',
      null,
      'UPDATE',
      {
        hasDebt: [before.hasDebt, after.hasDebt],
        amount: [before.amount, after.amount],
        debtSince: [before.debtSince, after.debtSince],
        paymentContact: [before.paymentContact, after.paymentContact],
      },
      user,
    );
    return after;
  }
}

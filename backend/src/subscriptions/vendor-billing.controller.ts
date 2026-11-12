import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowVendor, CurrentUser, Roles } from '../common/decorators/auth.decorators.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import type {
  BillingSettingsView,
  InvoiceView,
  VendorSubscriptionRow,
} from '../shared/interfaces/subscription.interface.js';
import { BillingSettingsDto, ExtendTrialDto, MarkPaidDto, VendorInvoiceDto } from './subscriptions.dto.js';
import { SubscriptionsService } from './subscriptions.service.js';

/**
 * The vendor (ТОВ «ПАВ ІТ»): prices and requisites, the subscriptions of the clients, their invoices.
 * No personal data of employees here — only the requisites of the legal entities and who signed up.
 */
@ApiTags('billing')
@AllowVendor()
@Roles('VENDOR', 'ADMIN')
@Controller('billing')
export class VendorBillingController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('settings')
  settings(): Promise<BillingSettingsView> {
    return this.subscriptions.settings();
  }

  @Put('settings')
  update(@Body() dto: BillingSettingsDto, @CurrentUser() user: AuthUser): Promise<BillingSettingsView> {
    return this.subscriptions.updateSettings(dto, user);
  }

  @Get('subscriptions')
  list(): Promise<VendorSubscriptionRow[]> {
    return this.subscriptions.list();
  }

  @Post('subscriptions/:id/trial')
  @HttpCode(200)
  trial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendTrialDto,
    @CurrentUser() user: AuthUser,
  ): Promise<VendorSubscriptionRow> {
    return this.subscriptions.extendTrial(id, dto.until, user);
  }

  @Post('subscriptions/:id/invoices')
  invoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VendorInvoiceDto,
    @CurrentUser() user: AuthUser,
  ): Promise<InvoiceView> {
    return this.subscriptions.vendorInvoice(id, dto, user);
  }

  @Get('invoices')
  invoices(@Query('subscription') subscription?: string): Promise<InvoiceView[]> {
    const id = subscription && /^[0-9a-f-]{36}$/i.test(subscription) ? subscription : undefined;
    return this.subscriptions.vendorInvoices(id);
  }

  @Post('invoices/:id/paid')
  @HttpCode(200)
  paid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPaidDto,
    @CurrentUser() user: AuthUser,
  ): Promise<InvoiceView> {
    return this.subscriptions.markPaid(id, dto.paidAt, user);
  }

  @Post('invoices/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<InvoiceView> {
    return this.subscriptions.cancel(id, user);
  }
}

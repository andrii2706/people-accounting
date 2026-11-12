import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AllowPendingTerms,
  AllowUnassigned,
  AllowUnpaid,
  AllowVendor,
  CurrentUser,
  Public,
} from '../common/decorators/auth.decorators.js';
import { docxFile } from '../common/utils/file-response.utils.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import type {
  InvoiceView,
  OfferDocument,
  OfferStatus,
  SubscriptionView,
  TermsDocument,
} from '../shared/interfaces/subscription.interface.js';
import { OfferService } from './offer.service.js';
import { ChoosePlanDto, OfferSignDto } from './subscriptions.dto.js';
import { SubscriptionsService } from './subscriptions.service.js';

/** The offer: public text; accepted only by the head's KEP on the acceptance document. */
@ApiTags('terms')
@Controller('terms')
export class TermsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly offers: OfferService,
  ) {}

  @Public()
  @Get()
  terms(): Promise<TermsDocument> {
    return this.subscriptions.terms();
  }

  @AllowPendingTerms()
  @AllowUnassigned()
  @AllowUnpaid()
  @Get('status')
  status(@CurrentUser() user: AuthUser): Promise<OfferStatus> {
    return this.offers.status(user);
  }

  /** The acceptance document to sign (the director, the entity admin). */
  @AllowPendingTerms()
  @AllowUnpaid()
  @Post('document')
  document(@CurrentUser() user: AuthUser): Promise<OfferDocument> {
    return this.offers.document(user);
  }

  /** The head's detached KEP signature of the document; the legal entity may work from now on. */
  @AllowPendingTerms()
  @AllowUnpaid()
  @Post('document/:id/sign')
  @HttpCode(200)
  sign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OfferSignDto,
    @CurrentUser() user: AuthUser,
  ): Promise<OfferStatus> {
    return this.offers.sign(user, id, dto.signature);
  }
}

/** The subscription of the user's legal entity: the plan, the free period, the invoices. */
@ApiTags('subscription')
@Controller('subscription')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @AllowUnassigned()
  @AllowUnpaid()
  @Get()
  view(@CurrentUser() user: AuthUser): Promise<SubscriptionView> {
    return this.subscriptions.view(user);
  }

  @AllowUnpaid()
  @Post('plan')
  @HttpCode(200)
  choose(@Body() dto: ChoosePlanDto, @CurrentUser() user: AuthUser): Promise<SubscriptionView> {
    return this.subscriptions.choosePlan(user, dto.plan, dto.note);
  }

  /** An invoice for the next period (or the unpaid one already issued). */
  @AllowUnpaid()
  @Post('invoices')
  renew(@CurrentUser() user: AuthUser): Promise<InvoiceView> {
    return this.subscriptions.renew(user);
  }

  @AllowUnpaid()
  @AllowVendor()
  @Get('invoices/:id/docx')
  async docx(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const { buffer, filename } = await this.subscriptions.invoiceFile(id, user);
    return docxFile(buffer, filename);
  }
}

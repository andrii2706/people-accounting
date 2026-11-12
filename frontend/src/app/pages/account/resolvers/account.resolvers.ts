import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { forkJoin, from } from 'rxjs';
import type {
  OfferPageData,
  SubscriptionView,
} from '../../../shared/interfaces/subscription.interface';
import { AccountService } from '../../../shared/services/account.service';
import { resolveOr } from '../../../shared/utils/router.utils';

/** The offer text and where the legal entity stands with it. */
export const termsResolver: ResolveFn<OfferPageData> = () => {
  const account = inject(AccountService);
  return resolveOr(
    forkJoin({ terms: account.terms(), status: account.offerStatus() }),
    '/',
  ) as never;
};

/** Always fresh: the page shows the invoices and the term of access. */
export const subscriptionResolver: ResolveFn<SubscriptionView> = () =>
  resolveOr(from(inject(AccountService).subscriptionState(true)), '/') as never;

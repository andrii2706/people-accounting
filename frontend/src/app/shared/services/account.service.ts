import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SUBSCRIPTION_CACHE_MS } from '../constants/subscription.constants';
import type {
  MessageResponse,
  SignupInfo,
  SignupRequestView,
  SignupStatement,
  SignupStatementRequest,
} from '../interfaces/auth.interface';
import type {
  InvoiceView,
  OfferDocument,
  OfferStatus,
  PlanCode,
  SubscriptionView,
  TermsDocument,
} from '../interfaces/subscription.interface';

/** Sign-up, the agreement, the subscription of the user's legal entity. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private cached: { view: SubscriptionView; at: number } | null = null;
  /** The legal entity of the user works by subscription — the menu shows «Підписка й рахунки». */
  readonly billingRequired = signal(false);

  private remember(view: SubscriptionView) {
    this.cached = { view, at: Date.now() };
    this.billingRequired.set(view.required);
  }

  registerInfo() {
    return firstValueFrom(this.http.get<SignupInfo>('/api/auth/register'));
  }

  /** Step 1 of the sign-up: the statement to sign. */
  signupStatement(body: SignupStatementRequest) {
    return firstValueFrom(this.http.post<SignupStatement>('/api/auth/register/statement', body));
  }

  /** Step 2: the head's KEP signature of the statement (base64 .p7s). */
  signupSign(id: string, signature: string) {
    return firstValueFrom(
      this.http.post<MessageResponse>(`/api/auth/register/${id}/sign`, { signature }),
    );
  }

  /** The main administrator: approved and refused sign-ups. */
  signups() {
    return this.http.get<SignupRequestView[]>('/api/signups');
  }

  terms() {
    return this.http.get<TermsDocument>('/api/terms');
  }

  offerStatus() {
    return this.http.get<OfferStatus>('/api/terms/status');
  }

  /** A new acceptance document of the offer (the head signs exactly these bytes). */
  offerDocument() {
    return firstValueFrom(this.http.post<OfferDocument>('/api/terms/document', {}));
  }

  signOffer(id: string, signature: string) {
    return firstValueFrom(
      this.http.post<OfferStatus>(`/api/terms/document/${id}/sign`, { signature }),
    );
  }

  subscription() {
    return this.http.get<SubscriptionView>('/api/subscription');
  }

  /** For the guards: the state at most a minute old. */
  async subscriptionState(force = false): Promise<SubscriptionView> {
    if (!force && this.cached && Date.now() - this.cached.at < SUBSCRIPTION_CACHE_MS)
      return this.cached.view;
    const view = await firstValueFrom(this.subscription());
    this.remember(view);
    return view;
  }

  forget() {
    this.cached = null;
  }

  async choosePlan(plan: PlanCode, note = '') {
    const view = await firstValueFrom(
      this.http.post<SubscriptionView>('/api/subscription/plan', { plan, note }),
    );
    this.remember(view);
    return view;
  }

  async renew() {
    const invoice = await firstValueFrom(
      this.http.post<InvoiceView>('/api/subscription/invoices', {}),
    );
    this.forget();
    return invoice;
  }

  invoiceUrl(id: string) {
    return `/api/subscription/invoices/${id}/docx`;
  }
}

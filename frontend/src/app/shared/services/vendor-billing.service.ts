import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  BillingSettingsView,
  InvoiceView,
  VendorInvoiceRequest,
  VendorSubscriptionRow,
} from '../interfaces/subscription.interface';

/** The vendor: prices and requisites, subscriptions of the clients, invoices. */
@Injectable({ providedIn: 'root' })
export class VendorBillingService {
  private readonly http = inject(HttpClient);

  settings() {
    return this.http.get<BillingSettingsView>('/api/billing/settings');
  }

  saveSettings(body: Omit<BillingSettingsView, 'ready'>) {
    return firstValueFrom(this.http.put<BillingSettingsView>('/api/billing/settings', body));
  }

  subscriptions() {
    return this.http.get<VendorSubscriptionRow[]>('/api/billing/subscriptions');
  }

  invoices() {
    return this.http.get<InvoiceView[]>('/api/billing/invoices');
  }

  extendTrial(id: string, until: string) {
    return firstValueFrom(
      this.http.post<VendorSubscriptionRow>(`/api/billing/subscriptions/${id}/trial`, { until }),
    );
  }

  issueInvoice(id: string, body: VendorInvoiceRequest) {
    return firstValueFrom(
      this.http.post<InvoiceView>(`/api/billing/subscriptions/${id}/invoices`, body),
    );
  }

  markPaid(id: string, paidAt?: string) {
    return firstValueFrom(
      this.http.post<InvoiceView>(`/api/billing/invoices/${id}/paid`, paidAt ? { paidAt } : {}),
    );
  }

  cancel(id: string) {
    return firstValueFrom(this.http.post<InvoiceView>(`/api/billing/invoices/${id}/cancel`, {}));
  }

  invoiceUrl(id: string) {
    return `/api/subscription/invoices/${id}/docx`;
  }
}

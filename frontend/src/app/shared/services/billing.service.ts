import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  BillingRecord,
  BillingStatus,
  UpdateBillingRequest,
} from '../interfaces/billing.interface';

/** Debt for using the system: the status for everyone, the record for the vendor. */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);

  status() {
    return firstValueFrom(this.http.get<BillingStatus>('/api/billing/status'));
  }

  record() {
    return this.http.get<BillingRecord>('/api/billing');
  }

  update(body: UpdateBillingRequest) {
    return firstValueFrom(this.http.put<BillingRecord>('/api/billing', body));
  }
}

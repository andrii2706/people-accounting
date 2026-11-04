import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  DecreeCheckResult,
  NotificationStatus,
  Organization,
  TestMailResult,
} from '../interfaces/organization.interface';

/** Parameters shared by all legal entities (terms, mobilization) and the e-mail status. */
@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly http = inject(HttpClient);

  organization() {
    return this.http.get<Organization>('/api/organization');
  }

  update(body: Partial<Organization>) {
    return firstValueFrom(this.http.put<Organization>('/api/organization', body));
  }

  /** E-mail status; with `entity` — recipients of that legal entity's reminders. */
  notificationStatus(entity = '') {
    return this.http.get<NotificationStatus>('/api/notifications/status', {
      params: entity ? { entity } : {},
    });
  }

  testMail() {
    return firstValueFrom(this.http.post<TestMailResult>('/api/notifications/test', {}));
  }

  checkDecrees() {
    return firstValueFrom(
      this.http.post<DecreeCheckResult>('/api/notifications/check-decrees', {}),
    );
  }
}

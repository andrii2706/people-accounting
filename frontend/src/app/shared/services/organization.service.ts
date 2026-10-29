import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  DecreeCheckResult,
  NotificationStatus,
  Organization,
  OrganizationHead,
  ResponsiblePerson,
} from '../interfaces/organization.interface';
import type { Tck } from '../interfaces/dictionary.interface';

export type TckImportItem = Pick<Tck, 'name'> &
  Partial<Pick<Tck, 'nameGenitive' | 'address' | 'postalCode' | 'phone' | 'email'>>;

/** Company details and persons responsible for military registration. */
@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly http = inject(HttpClient);

  organization() {
    return this.http.get<Organization>('/api/organization');
  }

  responsiblePersons() {
    return this.http.get<ResponsiblePerson[]>('/api/organization/responsible-persons');
  }

  update(body: Partial<Organization>) {
    return firstValueFrom(this.http.put<Organization>('/api/organization', body));
  }

  createResponsible(body: Omit<ResponsiblePerson, 'id'>) {
    return firstValueFrom(
      this.http.post<ResponsiblePerson>('/api/organization/responsible-persons', body),
    );
  }

  removeResponsible(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/organization/responsible-persons/${id}`));
  }

  heads() {
    return this.http.get<OrganizationHead[]>('/api/organization/heads');
  }

  createHead(body: Omit<OrganizationHead, 'id'>) {
    return firstValueFrom(this.http.post<OrganizationHead>('/api/organization/heads', body));
  }

  removeHead(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/organization/heads/${id}`));
  }

  notificationStatus() {
    return this.http.get<NotificationStatus>('/api/notifications/status');
  }

  testMail() {
    return firstValueFrom(this.http.post<{ sent: boolean }>('/api/notifications/test', {}));
  }

  checkDecrees() {
    return firstValueFrom(
      this.http.post<DecreeCheckResult>('/api/notifications/check-decrees', {}),
    );
  }

  importTck(items: TckImportItem[]) {
    return firstValueFrom(
      this.http.post<{ created: number; updated: number }>('/api/tck/import', { items }),
    );
  }
}

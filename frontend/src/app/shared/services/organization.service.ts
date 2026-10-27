import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Organization, ResponsiblePerson } from '../interfaces/organization.interface';

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
}

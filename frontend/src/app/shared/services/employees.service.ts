import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AuditEntry,
  EmployeeDetails,
  EmployeeList,
  EmployeePayload,
  PendingChange,
} from '../interfaces/employee.interface';

/**
 * Працівники та зміни облікових даних.
 * Observable-методи — для резолверів (дані готові до відкриття сторінки, на SSR не дублюються);
 * *Resource — для фонових/реактивних даних (лічильник у меню, журнал дій на вимогу).
 */
@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private readonly http = inject(HttpClient);

  list(params: Record<string, string>) {
    return this.http.get<EmployeeList>('/api/employees', { params });
  }

  details(id: string) {
    return this.http.get<EmployeeDetails>(`/api/employees/${id}`);
  }

  pendingChanges() {
    return this.http.get<PendingChange[]>('/api/employees/changes/pending');
  }

  /** `trigger` повертає undefined — запит не виконується (наприклад, до зміни тимчасового пароля). */
  pendingChangesResource(trigger: () => unknown = () => 0) {
    return httpResource<PendingChange[]>(
      () => (trigger() === undefined ? undefined : '/api/employees/changes/pending'),
      { defaultValue: [] },
    );
  }

  auditResource(id: () => string | undefined) {
    return httpResource<AuditEntry[]>(() => (id() ? `/api/employees/${id()}/audit` : undefined), {
      defaultValue: [],
    });
  }

  create(payload: EmployeePayload) {
    return firstValueFrom(this.http.post<EmployeeDetails>('/api/employees', payload));
  }

  update(id: string, payload: EmployeePayload) {
    return firstValueFrom(this.http.patch<EmployeeDetails>(`/api/employees/${id}`, payload));
  }

  dismiss(
    id: string,
    body: {
      dismissalDate: string;
      dismissalOrderNumber?: string;
      dismissalOrderDate?: string | null;
    },
  ) {
    return firstValueFrom(this.http.post<EmployeeDetails>(`/api/employees/${id}/dismiss`, body));
  }

  remove(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/employees/${id}`));
  }

  updateChange(id: string, body: { effectiveDate?: string; basis?: string; skipped?: boolean }) {
    return firstValueFrom(this.http.patch(`/api/employees/changes/${id}`, body));
  }
}

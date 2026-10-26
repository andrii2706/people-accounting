import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  EmployeeDetails,
  EmployeePayload,
  LetterDetails,
  ListGroup,
  Organization,
  ResponsiblePerson,
  Tck,
  AuthUser,
  UserRole,
} from './api.types';

/**
 * Мутації (POST/PATCH/DELETE). Читання робиться через httpResource прямо в компонентах —
 * так стан завантаження/помилки одразу доступний як сигнали.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // --- працівники
  createEmployee(payload: EmployeePayload) {
    return firstValueFrom(this.http.post<EmployeeDetails>('/api/employees', payload));
  }
  updateEmployee(id: string, payload: EmployeePayload) {
    return firstValueFrom(this.http.patch<EmployeeDetails>(`/api/employees/${id}`, payload));
  }
  dismissEmployee(id: string, body: { dismissalDate: string; dismissalOrderNumber?: string; dismissalOrderDate?: string | null }) {
    return firstValueFrom(this.http.post<EmployeeDetails>(`/api/employees/${id}/dismiss`, body));
  }
  deleteEmployee(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/employees/${id}`));
  }
  updateChange(id: string, body: { effectiveDate?: string; basis?: string; skipped?: boolean }) {
    return firstValueFrom(this.http.patch(`/api/employees/changes/${id}`, body));
  }

  // --- листи
  createChangeNotice(employeeId: string, changeIds?: string[]) {
    return firstValueFrom(this.http.post<LetterDetails>('/api/letters/change-notice', { employeeId, changeIds }));
  }
  createReportLetter(body: { type: 'LISTS' | 'OPERATIONAL_REPORT'; reportDate: string; groups?: ListGroup[]; employeeIds?: string[]; tckId?: string }) {
    return firstValueFrom(this.http.post<LetterDetails>('/api/letters/report', body));
  }
  updateLetter(id: string, body: { number?: string; date?: string; recipientEmail?: string; tckId?: string }) {
    return firstValueFrom(this.http.patch<LetterDetails>(`/api/letters/${id}`, body));
  }
  deleteLetter(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/letters/${id}`));
  }
  sendLetter(id: string, body: { to?: string; cc?: string; message?: string }) {
    return firstValueFrom(this.http.post<LetterDetails>(`/api/letters/${id}/send`, body));
  }
  markLetterSent(id: string) {
    return firstValueFrom(this.http.post<LetterDetails>(`/api/letters/${id}/mark-sent`, {}));
  }

  // --- налаштування
  updateOrganization(body: Partial<Organization>) {
    return firstValueFrom(this.http.put<Organization>('/api/organization', body));
  }
  createResponsible(body: Omit<ResponsiblePerson, 'id'>) {
    return firstValueFrom(this.http.post<ResponsiblePerson>('/api/organization/responsible-persons', body));
  }
  deleteResponsible(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/organization/responsible-persons/${id}`));
  }
  saveTck(body: Partial<Tck>, id?: string) {
    return firstValueFrom(id ? this.http.patch<Tck>(`/api/tck/${id}`, body) : this.http.post<Tck>('/api/tck', body));
  }
  createUser(body: { email: string; fullName: string; password: string; role: UserRole }) {
    return firstValueFrom(this.http.post<AuthUser>('/api/users', body));
  }
  updateUser(id: string, body: { isActive?: boolean; role?: UserRole; password?: string }) {
    return firstValueFrom(this.http.patch<AuthUser>(`/api/users/${id}`, body));
  }
}

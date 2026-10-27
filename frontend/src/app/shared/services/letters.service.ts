import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ListGroup } from '../interfaces/dictionary.interface';
import type { EmployeeNotice, Letter, LetterDetails } from '../interfaces/letter.interface';

/** Register of outgoing letters to the TCK, documents and hand-over. */
@Injectable({ providedIn: 'root' })
export class LettersService {
  private readonly http = inject(HttpClient);

  list(params: Record<string, string>) {
    return this.http.get<Letter[]>('/api/letters', { params });
  }

  details(id: string) {
    return this.http.get<LetterDetails>(`/api/letters/${id}`);
  }

  documentUrl(id: string) {
    return `/api/letters/${id}/docx`;
  }

  /** Notices for several employees — the server creates one letter per TCK. */
  createChangeNotices(employeeIds: string[], changeIds?: string[]) {
    return firstValueFrom(
      this.http.post<LetterDetails[]>('/api/letters/change-notices', { employeeIds, changeIds }),
    );
  }

  /** Stored notices of an employee (history in the employee card). */
  employeeNotices(employeeId: string) {
    return this.http.get<EmployeeNotice[]>('/api/change-notices', { params: { employeeId } });
  }

  noticeDocxUrl(noticeId: string) {
    return `/api/change-notices/${noticeId}/docx`;
  }

  /** Envelope labels (sender / recipient) for one or many letters. */
  labelsUrl(letterIds: string[]) {
    return `/api/letters/labels?ids=${letterIds.join(',')}`;
  }

  createChangeNotice(employeeId: string, changeIds?: string[]) {
    return firstValueFrom(
      this.http.post<LetterDetails>('/api/letters/change-notice', { employeeId, changeIds }),
    );
  }

  createReport(body: {
    type: 'LISTS' | 'OPERATIONAL_REPORT';
    reportDate: string;
    groups?: ListGroup[];
    employeeIds?: string[];
    tckId?: string;
  }) {
    return firstValueFrom(this.http.post<LetterDetails>('/api/letters/report', body));
  }

  update(id: string, body: { number?: string; date?: string; tckId?: string }) {
    return firstValueFrom(this.http.patch<LetterDetails>(`/api/letters/${id}`, body));
  }

  remove(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/letters/${id}`));
  }

  /** The letter was handed over to the TCK outside the system (Ukrposhta, by hand, document management system, e-cabinet). */
  markSent(id: string) {
    return firstValueFrom(this.http.post<LetterDetails>(`/api/letters/${id}/mark-sent`, {}));
  }
}

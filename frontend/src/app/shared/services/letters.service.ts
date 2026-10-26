import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ListGroup } from '../interfaces/dictionary.interface';
import type { Letter, LetterDetails } from '../interfaces/letter.interface';

/** Журнал вихідних листів до ТЦК, документи й відправка. */
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

  update(
    id: string,
    body: { number?: string; date?: string; recipientEmail?: string; tckId?: string },
  ) {
    return firstValueFrom(this.http.patch<LetterDetails>(`/api/letters/${id}`, body));
  }

  remove(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/letters/${id}`));
  }

  send(id: string, body: { to?: string; cc?: string; message?: string }) {
    return firstValueFrom(this.http.post<LetterDetails>(`/api/letters/${id}/send`, body));
  }

  markSent(id: string) {
    return firstValueFrom(this.http.post<LetterDetails>(`/api/letters/${id}/mark-sent`, {}));
  }
}

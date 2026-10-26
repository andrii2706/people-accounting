import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Dashboard, ListsReport, OperationalReport } from '../interfaces/report.interface';

/** Звіти: огляд, списки (Дод. 13), відомість оперативного обліку (Дод. 12). */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);

  dashboard() {
    return this.http.get<Dashboard>('/api/reports/dashboard');
  }

  lists(date: string) {
    return this.http.get<ListsReport>('/api/reports/lists', { params: { date } });
  }

  operational(date: string) {
    return this.http.get<OperationalReport>('/api/reports/operational', { params: { date } });
  }

  listsDocxUrl(date?: string, group?: string | null, employeeIds?: string[]) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (group) params.set('groups', group);
    if (employeeIds?.length) params.set('ids', employeeIds.join(','));
    const query = params.toString();
    return `/api/reports/lists/docx${query ? `?${query}` : ''}`;
  }

  operationalDocxUrl(date: string) {
    return `/api/reports/operational/docx?date=${date}`;
  }
}

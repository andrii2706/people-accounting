import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  Dashboard,
  ListsDocxParams,
  ListsReport,
  OperationalReport,
  TckExtractSummary,
} from '../interfaces/report.interface';

/** Reports: dashboard, lists (Annex 5), extracts for the TCKs, operational report (Annex 12). */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);

  dashboard() {
    return this.http.get<Dashboard>('/api/reports/dashboard');
  }

  /** `entity` — one legal entity; empty — all of them. */
  lists(date: string, entity = '') {
    return this.http.get<ListsReport>('/api/reports/lists', {
      params: withEntity({ date }, entity),
    });
  }

  operational(date: string, entity = '') {
    return this.http.get<OperationalReport>('/api/reports/operational', {
      params: withEntity({ date }, entity),
    });
  }

  /** Every TCK with the number of people in each of the four lists — for the extracts. */
  extracts(date: string, entity = '') {
    return this.http.get<TckExtractSummary[]>('/api/reports/extracts', {
      params: withEntity({ date }, entity),
    });
  }

  /**
   * Annex 5 lists; with `ids` — an extract for those employees, with `tck` — an extract about the people
   * registered at that TCK; `groups` — only these lists.
   */
  listsDocxUrl(p: ListsDocxParams = {}) {
    const params = new URLSearchParams();
    if (p.date) params.set('date', p.date);
    if (p.ids?.length) params.set('ids', p.ids.join(','));
    if (p.tck) params.set('tck', p.tck);
    if (p.groups?.length) params.set('groups', p.groups.join(','));
    if (p.entity) params.set('entity', p.entity);
    const query = params.toString();
    return `/api/reports/lists/docx${query ? `?${query}` : ''}`;
  }

  operationalDocxUrl(date: string, entity = '') {
    return `/api/reports/operational/docx?date=${date}${entity ? `&entity=${entity}` : ''}`;
  }
}

const withEntity = (params: Record<string, string>, entity: string) =>
  entity ? { ...params, entity } : params;

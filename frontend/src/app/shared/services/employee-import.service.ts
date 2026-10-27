import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  CheckedImportRow,
  ImportPreview,
  ImportResult,
  ImportRow,
} from '../interfaces/employee-import.interface';

/** Bulk import of employees from .xlsx / .csv (1C, HR spreadsheets): preview → check → commit. */
@Injectable({ providedIn: 'root' })
export class EmployeeImportService {
  private readonly http = inject(HttpClient);

  readonly templateUrl = '/api/employees/import/template';

  /** The file is read on the server and checked; nothing is saved yet. */
  preview(file: File) {
    const body = new FormData();
    body.append('file', file, file.name);
    return firstValueFrom(this.http.post<ImportPreview>('/api/employees/import/preview', body));
  }

  check(rows: ImportRow[]) {
    return firstValueFrom(
      this.http.post<CheckedImportRow[]>('/api/employees/import/check', { rows: rows.map(plain) }),
    );
  }

  commit(rows: ImportRow[], hireNotices: boolean, fileName?: string) {
    return firstValueFrom(
      this.http.post<ImportResult>('/api/employees/import/commit', {
        rows: rows.map(plain),
        hireNotices,
        fileName,
      }),
    );
  }
}

const plain = ({ rowNumber, values, issues }: ImportRow): ImportRow => ({
  rowNumber,
  values,
  issues,
});

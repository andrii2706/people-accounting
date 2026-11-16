import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ListSection } from '../interfaces/dictionary.interface';
import type {
  ListSectionSettingsBody,
  ListSettings,
  ListSettingsPage,
  ListSnapshotReport,
  ListSnapshotSummary,
} from '../interfaces/list-settings.interface';

/** Formed lists («Сформувати») and how the lists of a legal entity look. */
@Injectable({ providedIn: 'root' })
export class ListsService {
  private readonly http = inject(HttpClient);

  /** The history of a legal entity, the latest first; `entity` empty — the user's only one. */
  snapshots(entity = '') {
    return this.http.get<ListSnapshotSummary[]>('/api/reports/lists/snapshots', {
      params: entity ? { entity } : {},
    });
  }

  snapshot(id: string) {
    return this.http.get<ListSnapshotReport>(`/api/reports/lists/snapshots/${id}`);
  }

  form(date: string, legalEntityId = '') {
    return firstValueFrom(
      this.http.post<ListSnapshotSummary>('/api/reports/lists/snapshots', {
        date,
        ...(legalEntityId ? { legalEntityId } : {}),
      }),
    );
  }

  remove(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/reports/lists/snapshots/${id}`));
  }

  /** All four lists (or one); a .zip when own Word templates are involved. */
  snapshotDocxUrl(id: string, section?: ListSection) {
    return `/api/reports/lists/snapshots/${id}/docx${section ? `?section=${section}` : ''}`;
  }

  settings(entityId: string) {
    return this.http.get<ListSettingsPage>(`/api/legal-entities/${entityId}/list-settings`);
  }

  save(entityId: string, section: ListSection, body: ListSectionSettingsBody) {
    return firstValueFrom(
      this.http.put<ListSettings>(`/api/legal-entities/${entityId}/list-settings/${section}`, body),
    );
  }

  uploadTemplate(entityId: string, section: ListSection, file: File) {
    const body = new FormData();
    body.append('file', file, file.name);
    return firstValueFrom(
      this.http.post<ListSettings>(
        `/api/legal-entities/${entityId}/list-settings/${section}/template`,
        body,
      ),
    );
  }

  removeTemplate(entityId: string, section: ListSection) {
    return firstValueFrom(
      this.http.delete<ListSettings>(
        `/api/legal-entities/${entityId}/list-settings/${section}/template`,
      ),
    );
  }

  templateUrl(entityId: string, section: ListSection) {
    return `/api/legal-entities/${entityId}/list-settings/${section}/template`;
  }

  exampleUrl(entityId: string, section: ListSection) {
    return `/api/legal-entities/${entityId}/list-settings/${section}/example`;
  }
}

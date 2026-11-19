import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  HrBatchSummary,
  HrBatchView,
  HrODataCheck,
  HrSyncForm,
  HrSyncSettingsView,
  HrTokenIssued,
} from '../interfaces/hr-sync.interface';

/** Employees from 1C / BAS: the settings of a legal entity, the key for 1C, the deliveries and their review. */
@Injectable({ providedIn: 'root' })
export class HrSyncService {
  private readonly http = inject(HttpClient);
  private readonly url = (entityId: string, path = '') =>
    `api/legal-entities/${entityId}/hr-sync${path}`;

  get(entityId: string) {
    return this.http.get<HrSyncSettingsView>(this.url(entityId));
  }

  history(entityId: string) {
    return this.http.get<HrBatchSummary[]>(this.url(entityId, '/batches'));
  }

  save(entityId: string, body: HrSyncForm) {
    return firstValueFrom(this.http.put<HrSyncSettingsView>(this.url(entityId), body));
  }

  remove(entityId: string) {
    return firstValueFrom(this.http.delete<void>(this.url(entityId)));
  }

  issueToken(entityId: string) {
    return firstValueFrom(this.http.post<HrTokenIssued>(this.url(entityId, '/token'), {}));
  }

  revokeToken(entityId: string) {
    return firstValueFrom(this.http.delete<HrSyncSettingsView>(this.url(entityId, '/token')));
  }

  check(entityId: string) {
    return firstValueFrom(this.http.post<HrODataCheck>(this.url(entityId, '/check'), {}));
  }

  pull(entityId: string) {
    return firstValueFrom(this.http.post<HrBatchView>(this.url(entityId, '/pull'), {}));
  }

  batch(entityId: string, batchId: string) {
    return firstValueFrom(this.http.get<HrBatchView>(this.url(entityId, `/batches/${batchId}`)));
  }

  apply(entityId: string, batchId: string) {
    return firstValueFrom(
      this.http.post<HrBatchView>(this.url(entityId, `/batches/${batchId}/apply`), {}),
    );
  }

  discard(entityId: string, batchId: string) {
    return firstValueFrom(
      this.http.post<HrBatchView>(this.url(entityId, `/batches/${batchId}/discard`), {}),
    );
  }
}

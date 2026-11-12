import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  DatabaseCheckResult,
  EntityDatabaseForm,
  EntityDatabaseView,
} from '../interfaces/entity-database.interface';

/** The own database of a legal entity (stage 1: the connection and its check). */
@Injectable({ providedIn: 'root' })
export class EntityDatabaseService {
  private readonly http = inject(HttpClient);

  get(entityId: string) {
    return this.http.get<EntityDatabaseView>(`/api/legal-entities/${entityId}/database`);
  }

  save(entityId: string, body: EntityDatabaseForm) {
    return firstValueFrom(
      this.http.put<EntityDatabaseView>(`/api/legal-entities/${entityId}/database`, body),
    );
  }

  check(entityId: string) {
    return firstValueFrom(
      this.http.post<DatabaseCheckResult>(`/api/legal-entities/${entityId}/database/check`, {}),
    );
  }

  remove(entityId: string) {
    return firstValueFrom(this.http.delete<void>(`/api/legal-entities/${entityId}/database`));
  }
}

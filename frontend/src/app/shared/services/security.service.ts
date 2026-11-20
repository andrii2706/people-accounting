import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ExportTrace, SecurityEventsPage } from '../interfaces/security.interface';

/** The security journal and «who downloaded this file» (the administrators / director). */
@Injectable({ providedIn: 'root' })
export class SecurityService {
  private readonly http = inject(HttpClient);

  events(params: { kind?: string; page: number; size: number }) {
    const query: Record<string, string> = { page: String(params.page), size: String(params.size) };
    if (params.kind) query['kind'] = params.kind;
    return firstValueFrom(
      this.http.get<SecurityEventsPage>('api/security/events', { params: query }),
    );
  }

  /** Only the SHA-256 of the file is sent — the file stays on the computer. */
  trace(sha256: string) {
    return firstValueFrom(this.http.post<ExportTrace[]>('api/security/trace', { sha256 }));
  }
}

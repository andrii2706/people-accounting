import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  finalize,
  firstValueFrom,
  forkJoin,
  map,
  type Observable,
  of,
  shareReplay,
  tap,
} from 'rxjs';
import type { Gender } from '../interfaces/common.interface';
import type {
  Dictionaries,
  DutyCategory,
  ListGroup,
  MaritalStatus,
  Rank,
  Tck,
} from '../interfaces/dictionary.interface';

/**
 * Dictionaries (ranks, TCKs, statuses…). Loaded once by the shell resolver
 * and then kept in signals — pages get them ready to use.
 */
@Injectable({ providedIn: 'root' })
export class DictionariesService {
  private readonly http = inject(HttpClient);
  private readonly _dictionaries = signal<Dictionaries | undefined>(undefined);
  private readonly _tcks = signal<Tck[]>([]);
  private inFlight: Observable<void> | null = null;

  readonly dictionaries = this._dictionaries.asReadonly();
  readonly ranks = computed<Rank[]>(() => this._dictionaries()?.ranks ?? []);
  readonly tcks = this._tcks.asReadonly();
  readonly activeTcks = computed(() => this._tcks().filter((t) => t.isActive));

  private readonly rankByCode = computed(() => new Map(this.ranks().map((r) => [r.code, r])));
  private readonly groupTitles = computed(
    () => new Map((this._dictionaries()?.listGroups ?? []).map((g) => [g.value, g.label])),
  );
  private readonly categoryTitles = computed(
    () => new Map((this._dictionaries()?.dutyCategories ?? []).map((g) => [g.value, g.label])),
  );

  /** For the resolver: instant if already loaded; concurrent calls share one request. */
  load(): Observable<void> {
    if (this._dictionaries()) return of(undefined);
    this.inFlight ??= forkJoin({
      dictionaries: this.http.get<Dictionaries>('/api/dictionaries'),
      tcks: this.http.get<Tck[]>('/api/tck'),
    }).pipe(
      tap(({ dictionaries, tcks }) => {
        this._dictionaries.set(dictionaries);
        this._tcks.set(tcks);
      }),
      map(() => undefined),
      finalize(() => (this.inFlight = null)),
      shareReplay(1),
    );
    return this.inFlight;
  }

  async reloadTcks() {
    this._tcks.set(await firstValueFrom(this.http.get<Tck[]>('/api/tck')));
  }

  saveTck(body: Partial<Tck>, id?: string) {
    return firstValueFrom(
      id ? this.http.patch<Tck>(`/api/tck/${id}`, body) : this.http.post<Tck>('/api/tck', body),
    );
  }

  rank(code: number | null | undefined): Rank | undefined {
    return code === null || code === undefined ? undefined : this.rankByCode().get(code);
  }

  groupTitle(group: ListGroup | null | undefined): string {
    return group ? (this.groupTitles().get(group) ?? group) : '—';
  }

  categoryTitle(category: DutyCategory | null | undefined): string {
    return category ? (this.categoryTitles().get(category) ?? category) : '—';
  }

  maritalLabel(status: MaritalStatus | null | undefined, gender: Gender): string {
    const item = this._dictionaries()?.maritalStatuses.find((m) => m.value === status);
    return item ? (gender === 'F' ? item.labelF : item.labelM) : '';
  }
}

import { httpResource } from '@angular/common/http';
import { computed, Injectable } from '@angular/core';
import type { Dictionaries, DutyCategory, Gender, ListGroup, MaritalStatus, Rank, Tck } from './api.types';

/** Довідники завантажуються один раз і живуть у сигналах. */
@Injectable({ providedIn: 'root' })
export class DictionariesStore {
  private readonly dictResource = httpResource<Dictionaries>(() => '/api/dictionaries');
  private readonly tckResource = httpResource<Tck[]>(() => '/api/tck', { defaultValue: [] });

  readonly dictionaries = computed(() => this.dictResource.value());
  readonly ranks = computed<Rank[]>(() => this.dictResource.value()?.ranks ?? []);
  readonly tcks = computed(() => this.tckResource.value());
  readonly activeTcks = computed(() => this.tcks().filter((t) => t.isActive));
  readonly loading = computed(() => this.dictResource.isLoading() || this.tckResource.isLoading());

  private readonly rankByCode = computed(() => new Map(this.ranks().map((r) => [r.code, r])));
  private readonly groupTitles = computed(
    () => new Map((this.dictResource.value()?.listGroups ?? []).map((g) => [g.value, g.label])),
  );
  private readonly categoryTitles = computed(
    () => new Map((this.dictResource.value()?.dutyCategories ?? []).map((g) => [g.value, g.label])),
  );

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
    const item = this.dictResource.value()?.maritalStatuses.find((m) => m.value === status);
    return item ? (gender === 'F' ? item.labelF : item.labelM) : '';
  }

  reloadTcks() {
    this.tckResource.reload();
  }
}

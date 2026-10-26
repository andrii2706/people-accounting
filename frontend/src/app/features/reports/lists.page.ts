import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api.interceptor';
import { ApiService } from '../../core/api/api.service';
import type { ListGroup, ListsReport } from '../../core/api/api.types';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { todayIso } from '../../shared/ua-date.pipe';

/** Колонки, видимі у попередньому перегляді (повний набір із 18 — у .docx). */
const PREVIEW_COLUMNS: { index: number; label: string; width?: string }[] = [
  { index: 0, label: '№' },
  { index: 1, label: 'Звання' },
  { index: 2, label: 'ПІБ', width: 'min-w-[200px]' },
  { index: 3, label: 'Народж.' },
  { index: 4, label: 'ЄДР / РНОКПП' },
  { index: 5, label: 'ВОС' },
  { index: 7, label: 'Категорія, ВОД', width: 'min-w-[200px]' },
  { index: 12, label: 'ТЦК', width: 'min-w-[180px]' },
  { index: 13, label: 'Спецоблік / резерв', width: 'min-w-[180px]' },
  { index: 14, label: 'Придатність' },
  { index: 16, label: 'Посада, акт', width: 'min-w-[220px]' },
  { index: 17, label: 'Повідомлення ТЦК', width: 'min-w-[160px]' },
];

@Component({
  selector: 'app-lists-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Icon, RouterLink],
  template: `
    <app-page-header
      eyebrow="Додаток 13 до Порядку"
      title="Списки персонального військового обліку"
      subtitle="Формуються автоматично з карток працівників за тими ж правилами, що й аркуші G1…G4R у файлі обліку."
    >
      <label class="flex items-center gap-2 text-sm">
        <span class="text-muted">Станом на</span>
        <input class="input w-auto" type="date" [value]="date()" (change)="date.set($any($event.target).value || today)" />
      </label>
      <a class="btn btn-secondary" [href]="downloadUrl(null)" download><app-icon name="download" /> Усі групи .docx</a>
      <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="register()"><app-icon name="mail" /> Зареєструвати лист</button>
    </app-page-header>

    <div class="mb-4 flex flex-wrap gap-2">
      @for (g of groups(); track g.group) {
        <button
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm"
          [class]="active() === g.group ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface hover:border-brand-500'"
          (click)="active.set(g.group)"
        >
          <span class="font-mono font-semibold">{{ g.group }}</span>
          <span class="ml-1.5 tabular-nums opacity-80">{{ g.rows.length }}</span>
        </button>
      }
    </div>

    @if (current(); as g) {
      <section class="card overflow-hidden">
        <header class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div>
            <p class="text-xs font-semibold tracking-wide text-muted uppercase">Списки персонального військового обліку</p>
            <h2 class="font-semibold">{{ g.title }}</h2>
          </div>
          <a class="btn btn-secondary" [href]="downloadUrl(g.group)" download><app-icon name="download" /> {{ g.group }} .docx</a>
        </header>
        <div class="overflow-x-auto">
          <table class="table-base text-xs">
            <thead>
              <tr>
                @for (c of columns; track c.index) {
                  <th [class]="c.width ?? ''">{{ c.label }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of g.rows; track row.employeeId) {
                <tr>
                  @for (c of columns; track c.index) {
                    <td [class]="c.width ?? ''">
                      @if (c.index === 2) {
                        <a [routerLink]="['/employees', row.employeeId]" class="font-medium hover:text-brand-600">{{ row.cells[c.index] }}</a>
                      } @else {
                        {{ row.cells[c.index] || '—' }}
                      }
                    </td>
                  }
                </tr>
              } @empty {
                <tr><td [attr.colspan]="columns.length" class="py-10 text-center text-sm text-muted">У цій групі станом на обрану дату нікого немає</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    } @else {
      <div class="card h-48 animate-pulse bg-sunken/50"></div>
    }
  `,
})
export class ListsPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly today = todayIso();
  protected readonly columns = PREVIEW_COLUMNS;
  protected readonly date = signal(this.today);
  protected readonly active = signal<ListGroup>('G1');
  protected readonly busy = signal(false);

  protected readonly report = httpResource<ListsReport>(() => ({ url: '/api/reports/lists', params: { date: this.date() } }));
  protected readonly groups = computed(() => this.report.value()?.groups ?? []);
  protected readonly current = computed(() => this.groups().find((g) => g.group === this.active()));

  protected downloadUrl(group: ListGroup | null) {
    return `/api/reports/lists/docx?date=${this.date()}${group ? `&groups=${group}` : ''}`;
  }

  /** Створює запис у журналі вихідних — документ отримає номер і дату. */
  protected async register() {
    this.busy.set(true);
    try {
      const nonEmpty = this.groups().filter((g) => g.rows.length).map((g) => g.group);
      const letter = await this.api.createReportLetter({ type: 'LISTS', reportDate: this.date(), groups: nonEmpty.length ? nonEmpty : undefined });
      this.toast.success(`Зареєстровано вих. № ${letter.number}`);
      await this.router.navigate(['/letters', letter.id]);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}

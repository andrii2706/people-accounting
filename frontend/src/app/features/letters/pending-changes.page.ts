import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api.interceptor';
import { ApiService } from '../../core/api/api.service';
import type { PendingChange } from '../../core/api/api.types';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { UaDatePipe } from '../../shared/ua-date.pipe';

interface EmployeeGroup {
  employeeId: string;
  fullName: string;
  tckId: string | null;
  tckName: string;
  tckEmail: string;
  overdue: boolean;
  changes: PendingChange[];
}

@Component({
  selector: 'app-pending-changes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, RouterLink, Icon, UaDatePipe],
  template: `
    <app-page-header
      eyebrow="Повідомлення ТЦК"
      title="Зміни, про які треба повідомити"
      subtitle="Зміни облікових даних фіксуються автоматично при редагуванні картки. Для кожного працівника формується лист із повідомленнями за Додатком 4 та описом вкладення."
    />

    @if (pending.isLoading() && !pending.hasValue()) {
      <div class="card h-40 animate-pulse bg-sunken/50"></div>
    } @else {
      <div class="space-y-4">
        @for (g of groups(); track g.employeeId) {
          <section class="card overflow-hidden" [class.border-danger/40]="g.overdue">
            <header class="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-sunken/40 px-5 py-3">
              <div>
                <a [routerLink]="['/employees', g.employeeId]" class="font-semibold hover:text-brand-600">{{ g.fullName }}</a>
                <p class="text-xs text-muted">
                  {{ g.tckName || 'ТЦК не вказано' }}
                  @if (g.tckEmail) { · {{ g.tckEmail }} } @else if (g.tckName) { · <span class="text-warning">немає email ТЦК</span> }
                </p>
              </div>
              <button type="button" class="btn btn-primary" [disabled]="busy() === g.employeeId || !g.tckId" (click)="createLetter(g)">
                <app-icon name="file" /> Сформувати лист ({{ g.changes.length }})
              </button>
            </header>
            <ul class="divide-y divide-line">
              @for (c of g.changes; track c.id) {
                <li class="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                  <div class="min-w-0">
                    <p class="font-medium">{{ c.typeLabel }} <span class="font-normal text-muted">· з {{ c.effectiveDate | uaDate }}</span></p>
                    @if (c.newValue) { <p class="text-muted">{{ c.newValue }}</p> }
                    <p class="text-xs text-muted">Підстава: {{ c.basis || 'не вказано' }}</p>
                  </div>
                  <p class="text-xs whitespace-nowrap" [class]="c.overdue ? 'font-semibold text-danger' : 'text-muted'">
                    {{ c.overdue ? 'прострочено з' : 'до' }} {{ c.deadline | uaDate }}
                  </p>
                </li>
              }
            </ul>
          </section>
        } @empty {
          <div class="card flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span class="grid size-12 place-items-center rounded-full bg-brand-100 text-brand-600"><app-icon name="check" [size]="22" /></span>
            <p class="font-medium">Усі зміни повідомлено</p>
            <p class="text-sm text-muted">Нові з’являться тут, щойно ви зміните ПІБ, посаду, адресу, паспорт, освіту чи сімейний стан працівника.</p>
          </div>
        }
      </div>
    }
  `,
})
export class PendingChangesPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly pending = httpResource<PendingChange[]>(() => '/api/employees/changes/pending', { defaultValue: [] });
  protected readonly busy = signal<string | null>(null);

  /** Групування по працівниках; прострочені — першими. */
  protected readonly groups = computed<EmployeeGroup[]>(() => {
    const map = new Map<string, EmployeeGroup>();
    for (const c of this.pending.value()) {
      const g = map.get(c.employee.id) ?? {
        employeeId: c.employee.id,
        fullName: c.employee.fullName,
        tckId: c.employee.tckId,
        tckName: c.employee.tckName,
        tckEmail: c.employee.tckEmail,
        overdue: false,
        changes: [],
      };
      g.changes.push(c);
      g.overdue ||= c.overdue;
      map.set(c.employee.id, g);
    }
    return [...map.values()].sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.fullName.localeCompare(b.fullName, 'uk'));
  });

  protected async createLetter(g: EmployeeGroup) {
    this.busy.set(g.employeeId);
    try {
      const letter = await this.api.createChangeNotice(g.employeeId);
      this.toast.success(`Лист вих. № ${letter.number} сформовано`);
      await this.router.navigate(['/letters', letter.id]);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(null);
    }
  }
}

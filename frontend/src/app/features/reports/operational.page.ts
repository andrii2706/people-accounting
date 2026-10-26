import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api.interceptor';
import { ApiService } from '../../core/api/api.service';
import type { OperationalReport } from '../../core/api/api.types';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { todayIso } from '../../shared/ua-date.pipe';

@Component({
  selector: 'app-operational-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Icon],
  template: `
    <app-page-header
      eyebrow="Додаток 12 до Порядку"
      title="Відомість оперативного обліку"
      subtitle="Кількість призовників, військовозобов’язаних та резервістів за групами. Розрахунок — як на аркуші OCL."
    >
      <label class="flex items-center gap-2 text-sm">
        <span class="text-muted">Станом на</span>
        <input class="input w-auto" type="date" [value]="date()" (change)="date.set($any($event.target).value || today)" />
      </label>
      <a class="btn btn-secondary" [href]="'/api/reports/operational/docx?date=' + date()" download><app-icon name="download" /> .docx</a>
      <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="register()"><app-icon name="mail" /> Зареєструвати лист</button>
    </app-page-header>

    <div class="card overflow-x-auto">
      <table class="table-base">
        <thead>
          <tr>
            <th class="w-16">№</th>
            <th>Найменування групи</th>
            <th class="text-right">Усього</th>
            <th class="text-right">Мають моб. розпорядження</th>
            <th class="text-right">Заброньовані</th>
            <th class="text-right">Не заброньовані, без розпоряджень</th>
            <th class="text-right">Прийнято з 01.01.2020</th>
            <th class="text-right">Звільнено з 01.01.2020</th>
          </tr>
        </thead>
        <tbody [class.opacity-50]="report.isLoading()">
          @for (r of rows(); track r.code) {
            <tr [class.font-semibold]="r.code.endsWith('.')">
              <td class="font-mono">{{ r.code }}</td>
              <td>{{ r.title }}</td>
              <td class="text-right tabular-nums">{{ r.total || '—' }}</td>
              <td class="text-right tabular-nums">{{ r.mobilizationOrders || '—' }}</td>
              <td class="text-right tabular-nums">{{ r.reserved || '—' }}</td>
              <td class="text-right tabular-nums">{{ r.other || '—' }}</td>
              <td class="text-right tabular-nums">{{ r.hiredSince2020 || '—' }}</td>
              <td class="text-right tabular-nums">{{ r.dismissedSince2020 || '—' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-muted">
      Звільнені у поточному році враховуються лише в колонці «звільнено»; мобілізовані до відомості не входять.
    </p>
  `,
})
export class OperationalPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly today = todayIso();
  protected readonly date = signal(this.today);
  protected readonly busy = signal(false);
  protected readonly report = httpResource<OperationalReport>(() => ({ url: '/api/reports/operational', params: { date: this.date() } }));
  protected readonly rows = computed(() => this.report.value()?.rows ?? []);

  protected async register() {
    this.busy.set(true);
    try {
      const letter = await this.api.createReportLetter({ type: 'OPERATIONAL_REPORT', reportDate: this.date() });
      this.toast.success(`Зареєстровано вих. № ${letter.number}`);
      await this.router.navigate(['/letters', letter.id]);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}

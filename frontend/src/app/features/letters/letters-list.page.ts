import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Letter, LetterStatus, LetterType } from '../../core/api/api.types';
import { LetterStatusBadge } from '../../shared/badges';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { UaDatePipe } from '../../shared/ua-date.pipe';

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  CHANGE_NOTICE: 'Повідомлення про зміну даних',
  LISTS: 'Списки (Дод. 13)',
  OPERATIONAL_REPORT: 'Відомість (Дод. 12)',
  OTHER: 'Інше',
};

@Component({
  selector: 'app-letters-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, RouterLink, LetterStatusBadge, UaDatePipe, Icon],
  template: `
    <app-page-header eyebrow="Журнал" title="Вихідні листи" subtitle="Реєстр усіх листів до ТЦК з вихідними номерами, датами та статусом відправки." />

    <div class="card mb-4 flex flex-wrap gap-3 p-3">
      <select class="input w-auto" (change)="type.set($any($event.target).value)" aria-label="Тип">
        <option value="">Усі типи</option>
        @for (t of typeOptions; track t.value) {
          <option [value]="t.value" [selected]="t.value === type()">{{ t.label }}</option>
        }
      </select>
      <select class="input w-auto" [value]="status()" (change)="status.set($any($event.target).value)" aria-label="Статус">
        <option value="">Усі статуси</option>
        <option value="DRAFT">Чернетки</option>
        <option value="SENT">Надіслані</option>
        <option value="FAILED">З помилкою</option>
      </select>
    </div>

    <div class="card overflow-x-auto">
      <table class="table-base">
        <thead>
          <tr><th>Вих. №</th><th>Дата</th><th>Тип</th><th>Зміст</th><th>Адресат</th><th>Статус</th><th></th></tr>
        </thead>
        <tbody>
          @for (l of letters.value(); track l.id) {
            <tr>
              <td class="font-mono font-semibold whitespace-nowrap"><a [routerLink]="['/letters', l.id]" class="hover:text-brand-600">{{ l.number }}</a></td>
              <td class="whitespace-nowrap tabular-nums">{{ l.date | uaDate }}</td>
              <td class="text-sm whitespace-nowrap">{{ typeLabel(l.type) }}</td>
              <td class="max-w-[360px] text-sm">{{ l.subject }}</td>
              <td class="max-w-[220px] text-sm text-muted">{{ l.tck?.name || l.recipientEmail || '—' }}</td>
              <td><app-letter-status [status]="l.status" /></td>
              <td class="text-right"><a class="btn btn-ghost px-2" [href]="'/api/letters/' + l.id + '/docx'" download title="Завантажити .docx"><app-icon name="download" /></a></td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="py-12 text-center text-sm text-muted">{{ letters.isLoading() ? 'Завантаження…' : 'Листів ще немає' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class LettersListPage {
  protected readonly type = signal<LetterType | ''>('');
  protected readonly status = signal<LetterStatus | ''>('');
  protected readonly typeOptions = (Object.keys(LETTER_TYPE_LABELS) as LetterType[]).map((value) => ({ value, label: LETTER_TYPE_LABELS[value] }));

  private readonly params = computed(() => ({
    ...(this.type() ? { type: this.type() } : {}),
    ...(this.status() ? { status: this.status() } : {}),
  }));
  protected readonly letters = httpResource<Letter[]>(() => ({ url: '/api/letters', params: this.params() }), { defaultValue: [] });

  protected typeLabel(type: LetterType) {
    return LETTER_TYPE_LABELS[type];
  }
}

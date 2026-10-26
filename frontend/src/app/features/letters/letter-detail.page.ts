import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api.interceptor';
import { ApiService } from '../../core/api/api.service';
import type { LetterDetails } from '../../core/api/api.types';
import { DictionariesStore } from '../../core/api/dictionaries.store';
import { ToastService } from '../../core/ui/toast.service';
import { LetterStatusBadge } from '../../shared/badges';
import { FormFieldWrapper } from '../../shared/form-field';
import { Icon } from '../../shared/icon';
import { UaDatePipe, UaDateTimePipe } from '../../shared/ua-date.pipe';
import { LETTER_TYPE_LABELS } from './letters-list.page';

const DEFAULT_MESSAGE =
  'Добрий день!\n\nНадсилаємо документи з питань військового обліку працівників підприємства. Оригінали буде направлено поштою.';

@Component({
  selector: 'app-letter-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, LetterStatusBadge, UaDatePipe, UaDateTimePipe, FormField, FormFieldWrapper],
  template: `
    @if (letter.error()) {
      <div class="card p-6 text-sm text-danger">Лист не знайдено.</div>
    } @else if (l(); as l) {
      <a routerLink="/letters" class="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><app-icon name="arrowLeft" [size]="16" /> Журнал листів</a>

      <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="mb-1 text-xs font-semibold tracking-[0.14em] text-brand-600 uppercase">{{ typeLabel() }}</p>
          <h1 class="text-2xl font-semibold tracking-tight">Вих. № {{ l.number }} від {{ l.date | uaDate }}</h1>
          <p class="mt-1 text-sm text-muted">{{ l.subject }}</p>
        </div>
        <div class="flex items-center gap-2">
          <app-letter-status [status]="l.status" />
          <a class="btn btn-secondary" [href]="'/api/letters/' + l.id + '/docx'" download><app-icon name="download" /> Документ .docx</a>
        </div>
      </header>

      <div class="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div class="space-y-6">
          <section class="card p-5">
            <h2 class="mb-3 font-semibold">Склад листа</h2>
            <dl class="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt class="text-xs text-muted">Адресат</dt><dd>{{ l.tck?.name || '—' }}</dd></div>
              <div><dt class="text-xs text-muted">Адреса ТЦК</dt><dd>{{ l.tck?.address || '—' }}</dd></div>
              @if (l.employee) {
                <div><dt class="text-xs text-muted">Працівник</dt><dd><a [routerLink]="['/employees', l.employee.id]" class="text-brand-600 hover:underline">{{ l.employee.fullName }}</a></dd></div>
              }
              @if (l.params.reportDate) {
                <div><dt class="text-xs text-muted">Станом на</dt><dd>{{ l.params.reportDate | uaDate }}</dd></div>
              }
            </dl>

            @if (l.changes.length) {
              <h3 class="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Повідомлення у додатках</h3>
              <ol class="list-decimal space-y-1 pl-5 text-sm">
                @for (c of l.changes; track c.id) {
                  <li>{{ changeLabel(c.type) }} з {{ c.effectiveDate | uaDate }}@if (c.newValue) { — {{ c.newValue }}}</li>
                }
              </ol>
            }
            <p class="mt-4 text-xs text-muted">У документі: супровідний лист, повідомлення про зміну облікових даних (Додаток 4) та опис вкладення ф. 107 — якщо лист надсилається Укрпоштою.</p>
          </section>

          @if (l.status !== 'SENT') {
            <section class="card p-5">
              <h2 class="mb-3 font-semibold">Реквізити</h2>
              <div class="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label class="block"><span class="label">Вих. №</span><input class="input font-mono" [value]="number()" (input)="number.set($any($event.target).value)" /></label>
                <label class="block"><span class="label">Дата</span><input class="input" type="date" [value]="date()" (input)="date.set($any($event.target).value)" /></label>
                <button type="button" class="btn btn-secondary" (click)="saveMeta()">Зберегти</button>
              </div>
              <label class="mt-3 block">
                <span class="label">ТЦК-адресат</span>
                <select class="input" (change)="changeTck($any($event.target).value)">
                  <option value="" disabled [selected]="!l.tckId">— оберіть —</option>
                  @for (t of dict.activeTcks(); track t.id) {
                    <option [value]="t.id" [selected]="t.id === l.tckId">{{ t.name }}</option>
                  }
                </select>
              </label>
            </section>
          }

          @if (l.emails.length) {
            <section class="card p-5">
              <h2 class="mb-3 font-semibold">Історія відправки</h2>
              <ul class="space-y-2 text-sm">
                @for (m of l.emails; track m.id) {
                  <li class="rounded-lg bg-sunken/60 px-3 py-2">
                    <p><span class="font-medium" [class]="m.status === 'SENT' ? 'text-ok' : 'text-danger'">{{ m.status === 'SENT' ? 'Надіслано' : 'Помилка' }}</span> → {{ m.to }} <span class="text-muted">· {{ m.createdAt | uaDateTime }}</span></p>
                    @if (m.error) { <p class="mt-1 text-xs text-muted">{{ m.error }}</p> }
                  </li>
                }
              </ul>
            </section>
          }
        </div>

        <aside class="space-y-4">
          <form class="card space-y-4 p-5" (submit)="send($event)" novalidate>
            <h2 class="flex items-center gap-2 font-semibold"><app-icon name="send" /> Надіслати електронною поштою</h2>
            @if (!l.mailConfigured) {
              <p class="rounded-lg bg-[#fdf6ec] px-3 py-2 text-xs text-warning">SMTP не налаштовано — лист буде збережено на сервері (.eml) замість відправки. Налаштуйте SMTP_* у .env бекенду.</p>
            }
            <app-form-field label="Кому" [required]="true" [field]="sendForm.to">
              <input class="input" type="email" [formField]="sendForm.to" />
            </app-form-field>
            <app-form-field label="Копія" [field]="sendForm.cc">
              <input class="input" type="email" [formField]="sendForm.cc" />
            </app-form-field>
            <app-form-field label="Текст листа">
              <textarea class="input min-h-32" [formField]="sendForm.message"></textarea>
            </app-form-field>
            <button type="submit" class="btn btn-primary w-full" [disabled]="sendForm().submitting()">
              {{ sendForm().submitting() ? 'Надсилаємо…' : l.status === 'SENT' ? 'Надіслати ще раз' : 'Надіслати з документом' }}
            </button>
          </form>

          <div class="card space-y-2 p-5">
            @if (l.status !== 'SENT') {
              <button type="button" class="btn btn-secondary w-full" (click)="markSent()">Позначити як відправлений поштою</button>
              <button type="button" class="btn btn-danger w-full" (click)="remove()">Видалити чернетку</button>
              <p class="text-xs text-muted">Після видалення зміни повернуться в чергу «Повідомлення ТЦК».</p>
            } @else {
              <p class="text-sm text-muted">Відправлено {{ l.sentAt | uaDateTime }}. Надісланий лист не редагується.</p>
            }
          </div>
        </aside>
      </div>
    } @else {
      <div class="card h-64 animate-pulse bg-sunken/50"></div>
    }
  `,
})
export class LetterDetailPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly dict = inject(DictionariesStore);

  readonly id = input.required<string>();

  protected readonly letter = httpResource<LetterDetails>(() => `/api/letters/${this.id()}`);
  protected readonly l = computed(() => this.letter.value());
  protected readonly typeLabel = computed(() => (this.l() ? LETTER_TYPE_LABELS[this.l()!.type] : ''));

  protected readonly number = linkedSignal(() => this.l()?.number ?? '');
  protected readonly date = linkedSignal(() => this.l()?.date ?? '');

  protected readonly sendModel = linkedSignal(() => ({
    to: this.l()?.recipientEmail || this.l()?.tck?.email || '',
    cc: '',
    message: DEFAULT_MESSAGE,
  }));
  protected readonly sendForm = form(this.sendModel, (p) => {
    required(p.to, { message: 'Вкажіть email ТЦК' });
    validate(p.to, ({ value }) => (value() && !/^\S+@\S+\.\S+$/.test(value()) ? { kind: 'email', message: 'Некоректний email' } : undefined));
    validate(p.cc, ({ value }) => (value() && !/^\S+@\S+\.\S+$/.test(value()) ? { kind: 'email', message: 'Некоректний email' } : undefined));
  });

  protected readonly changeTypes = computed(() => new Map((this.dict.dictionaries()?.changeTypes ?? []).map((c) => [c.value, c.label])));
  protected changeLabel(type: string) {
    return this.changeTypes().get(type as never) ?? type;
  }

  protected async saveMeta() {
    await this.mutate(() => this.api.updateLetter(this.id(), { number: this.number(), date: this.date() }), 'Реквізити збережено');
  }

  protected async changeTck(tckId: string) {
    await this.mutate(() => this.api.updateLetter(this.id(), { tckId }), 'Адресата змінено');
  }

  protected async markSent() {
    await this.mutate(() => this.api.markLetterSent(this.id()), 'Позначено як відправлений');
  }

  protected async send(event: Event) {
    event.preventDefault();
    await submit(this.sendForm, async () => {
      const { to, cc, message } = this.sendModel();
      await this.mutate(() => this.api.sendLetter(this.id(), { to, cc: cc || undefined, message }), 'Лист надіслано');
      return undefined;
    });
  }

  protected async remove() {
    if (typeof window !== 'undefined' && !window.confirm('Видалити чернетку листа?')) return;
    try {
      await this.api.deleteLetter(this.id());
      this.toast.success('Чернетку видалено');
      await this.router.navigate(['/letters']);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }

  private readonly saving = signal(false);
  private async mutate(action: () => Promise<unknown>, success: string) {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await action();
      this.toast.success(success);
      this.letter.reload();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
      this.letter.reload();
    } finally {
      this.saving.set(false);
    }
  }
}

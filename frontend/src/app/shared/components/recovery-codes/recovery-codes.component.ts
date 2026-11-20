import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { ToastService } from '../../services/toast.service';
import { recoveryCodesText } from '../../utils/two-factor.utils';
import { saveBlob } from '../../utils/file.utils';

/**
 * The ten recovery codes, shown once: copy, save as a file, and «I have saved them» before going on.
 * Each works once — for the day the phone with the app is lost.
 */
@Component({
  selector: 'app-recovery-codes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="rounded-xl border border-warning/40 bg-[#fdf9f2] px-4 py-3 text-sm text-warning">
      Збережіть ці коди зараз — більше їх не буде показано. Кожен діє один раз, якщо телефон із
      застосунком загубився. Тримайте їх окремо від пароля.
    </div>
    <ol
      class="mt-4 grid grid-cols-2 gap-2 font-mono text-base tabular-nums"
      aria-label="Резервні коди"
    >
      @for (code of codes(); track code; let i = $index) {
        <li class="rounded-lg border border-line bg-sunken px-3 py-2 text-center">
          <span class="mr-1 text-xs text-muted">{{ i + 1 }}.</span>{{ code }}
        </li>
      }
    </ol>
    <div class="mt-4 flex flex-wrap gap-2">
      <button type="button" class="btn btn-secondary cursor-pointer" (click)="copy()">
        <app-icon name="copy" /> Копіювати
      </button>
      <button type="button" class="btn btn-secondary cursor-pointer" (click)="download()">
        <app-icon name="download" /> Зберегти файлом
      </button>
    </div>
    <label class="mt-5 flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        class="mt-0.5 size-4 accent-brand-600"
        [checked]="saved()"
        (change)="saved.set($any($event.target).checked)"
      />
      <span>Коди збережено в надійному місці</span>
    </label>
    <button
      type="button"
      class="btn btn-primary mt-5 w-full cursor-pointer py-2.5"
      [disabled]="!saved()"
      (click)="done.emit()"
    >
      {{ doneLabel() }}
    </button>
  `,
})
export class RecoveryCodesComponent {
  private readonly toast = inject(ToastService);

  readonly codes = input.required<string[]>();
  readonly email = input('');
  readonly doneLabel = input('Продовжити');
  readonly done = output<void>();

  protected readonly saved = signal(false);

  protected async copy() {
    try {
      await navigator.clipboard.writeText(this.codes().join('\n'));
      this.toast.success('Коди скопійовано');
    } catch {
      this.toast.error('Не вдалося скопіювати — збережіть коди файлом');
    }
  }

  protected download() {
    saveBlob(
      new Blob([recoveryCodesText(this.codes(), this.email())], {
        type: 'text/plain;charset=utf-8',
      }),
      'Резервні коди — Військовий облік.txt',
    );
  }
}

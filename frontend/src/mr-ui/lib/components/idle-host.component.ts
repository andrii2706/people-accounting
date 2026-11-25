import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { UiIdleService } from '../services/idle.service';

/**
 * The faces of the idle timeout: the countdown a minute before and, when the time is up, a cover over the whole page
 * («Сеанс завершено… повертаємо на портал») — shown at once, before the redirect, so nothing of the old page flashes.
 */
@Component({
  selector: 'ui-idle-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (idle.ended()) {
      <div
        class="fixed inset-0 z-[1000] grid place-items-center bg-base-200 px-4"
        role="alert"
        aria-live="assertive"
      >
        <div class="flex w-full max-w-sm flex-col items-center gap-3 text-center">
          <span
            class="grid size-13 place-items-center rounded-2xl bg-warning/15 text-warning"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <p class="text-lg font-semibold">Сеанс завершено</p>
          <p class="text-sm text-muted">
            Ви не працювали 10 хвилин, тому «{{ appTitle() }}» закрито. {{ leaving() }}
          </p>
          <span class="loading loading-dots loading-sm text-primary" aria-hidden="true"></span>
          <a class="link text-sm link-primary" [href]="href()">{{ linkText() }}</a>
        </div>
      </div>
    } @else if (idle.secondsLeft(); as seconds) {
      <div
        class="fixed inset-x-0 bottom-6 z-[900] mx-auto flex w-[min(34rem,calc(100%-2rem))] items-center gap-4 rounded-xl border border-warning/40 bg-base-100 px-5 py-4 shadow-lg"
        role="alertdialog"
        aria-live="assertive"
        aria-labelledby="ui-idle-title"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-5 shrink-0 text-warning"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <div class="min-w-0 flex-1 text-sm">
          <p id="ui-idle-title" class="font-semibold">
            Вихід через {{ seconds }} с через бездіяльність
          </p>
          <p class="text-muted">
            Незбережені зміни буде втрачено. Порухайте мишкою або натисніть кнопку.
          </p>
        </div>
        <button type="button" class="btn cursor-pointer btn-primary" (click)="idle.touch()">
          Залишитися
        </button>
      </div>
    }
  `,
})
export class UiIdleHostComponent {
  protected readonly idle = inject(UiIdleService);
  /** «Військовий облік», «Портал». */
  readonly appTitle = input.required<string>();
  readonly leaving = input('Повертаємо на портал…');
  readonly href = input('/');
  readonly linkText = input('Перейти на портал');
}

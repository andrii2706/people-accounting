import { afterNextRender, ChangeDetectionStrategy, Component } from '@angular/core';
import { MODULE_DENIED_URL } from '../../shared/constants/auth.constants';

/**
 * The account has other applications of the domain, not «Військовий облік». The page comes from the server
 * (which cannot redirect outside /oblik/); in the browser it goes on to the portal at once.
 */
@Component({
  selector: 'app-no-module',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 class="text-2xl font-semibold">Військовий облік не підключено</h1>
      <p class="max-w-md text-muted">
        Для вашого облікового запису цей модуль не підключено. На порталі — модулі, які вам
        доступні.
      </p>
      <a [href]="portal" class="btn btn-primary cursor-pointer">Перейти на портал</a>
    </main>
  `,
})
export class NoModuleComponent {
  protected readonly portal = MODULE_DENIED_URL;

  constructor() {
    afterNextRender(() => window.location.assign(MODULE_DENIED_URL));
  }
}

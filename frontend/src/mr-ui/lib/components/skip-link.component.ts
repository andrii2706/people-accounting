import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

/**
 * «Перейти до змісту» — the first stop of Tab on every page (WCAG 2.4.1): hidden until focused, then it jumps over
 * the menu to the main content and puts the focus there.
 */
@Component({
  selector: 'ui-skip-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a class="ui-skip-link" [href]="'#' + target()" (click)="jump($event)"
    >Перейти до змісту</a
  >`,
})
export class UiSkipLinkComponent {
  private readonly document = inject(DOCUMENT);
  /** the id of the main region (<main id="main">) */
  readonly target = input('main');

  protected jump(event: Event) {
    const main = this.document.getElementById(this.target());
    if (!main) return;
    event.preventDefault();
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    main.focus();
  }
}

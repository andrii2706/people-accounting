import { computed, Directive, effect, ElementRef, inject, input, Renderer2 } from '@angular/core';
import { delayedBusy } from '../utils/loading.utils';

/**
 * A button at work: aria-busy at once, and — when the wait is longer than 200 ms — the daisyUI spinner before its text.
 * The button keeps its own [disabled] (the template decides when it is not pressable) and its own words
 * («Створюю…»); the width does not jump.
 *
 *   <button class="btn btn-primary" [uiBusy]="saving()" [disabled]="saving()">{{ saving() ? 'Створюю…' : 'Створити' }}</button>
 */
@Directive({
  selector: '[uiBusy]',
  host: { '[attr.aria-busy]': 'uiBusy() ? "true" : null' },
})
export class UiBusyDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  readonly uiBusy = input(false);
  /** xs for small buttons */
  readonly uiBusySize = input<'xs' | 'sm'>('sm');

  private readonly visible = delayedBusy(computed(() => this.uiBusy()));
  private spinner: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const el = this.host.nativeElement;
      if (this.visible() && !this.spinner) {
        const span = this.renderer.createElement('span') as HTMLElement;
        for (const c of ['loading', 'loading-spinner', `loading-${this.uiBusySize()}`])
          this.renderer.addClass(span, c);
        this.renderer.setAttribute(span, 'aria-hidden', 'true');
        this.renderer.insertBefore(el, span, el.firstChild);
        this.spinner = span;
      } else if (!this.visible() && this.spinner) {
        this.renderer.removeChild(el, this.spinner);
        this.spinner = null;
      }
    });
  }
}

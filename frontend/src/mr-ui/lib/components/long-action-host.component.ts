import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, ElementRef, inject } from '@angular/core';
import { LongActionService } from '../services/long-action.service';

/**
 * The cover of a long action (LongActionService): over the whole page, the ball and what is happening. Everything
 * else becomes inert for its time — no click, no Tab gets there. Put it once in the root of the application.
 */
@Component({
  selector: 'ui-long-action-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (actions.state(); as s) {
      <!-- read out once by AnnouncerService; the cover itself is not a live region (no double reading) -->
      <div
        class="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-base-100/80 px-6 text-center backdrop-blur-[1px]"
      >
        <span class="loading loading-ball loading-xl text-primary" aria-hidden="true"></span>
        <p class="text-base font-medium">{{ s.label }}</p>
        @if (s.hint) {
          <p class="text-sm text-muted">{{ s.hint }}</p>
        }
      </div>
    }
  `,
})
export class UiLongActionHostComponent {
  protected readonly actions = inject(LongActionService);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      const busy = !!this.actions.state();
      // the rest of the page is out of reach while the action runs: every sibling on the way from the cover up to <body>
      let node: HTMLElement | null = this.host.nativeElement;
      while (node && node !== this.document.body) {
        const parent: HTMLElement | null = node.parentElement;
        for (const sibling of Array.from(parent?.children ?? [])) {
          if (sibling !== node && sibling.tagName !== 'SCRIPT')
            sibling.toggleAttribute('inert', busy);
        }
        node = parent;
      }
    });
  }
}

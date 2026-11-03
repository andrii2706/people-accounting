import { afterNextRender, DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';

/**
 * Emits when the element scrolls into view (with a margin, so the next rows are ready before the user
 * reaches the end). Used to render long lists in portions instead of thousands of rows at once.
 * Browser only: on the server nothing is observed.
 */
@Directive({ selector: '[appInView]' })
export class InViewDirective {
  readonly appInView = output<void>();

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) this.appInView.emit();
        },
        { rootMargin: '600px 0px' },
      );
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}

import { LiveAnnouncer } from '@angular/cdk/a11y';
import { inject, Injectable } from '@angular/core';

/**
 * One voice for screen readers (WCAG 4.1.3): «Збережено», «Завантаження», «Підписано 12 листів» — read without moving
 * the focus. Polite waits for the reader to finish; assertive interrupts (errors only).
 */
@Injectable({ providedIn: 'root' })
export class AnnouncerService {
  private readonly live = inject(LiveAnnouncer);

  polite(message: string) {
    void this.live.announce(message, 'polite');
  }

  assertive(message: string) {
    void this.live.announce(message, 'assertive');
  }
}

import { inject, Injectable, signal } from '@angular/core';
import type { LongActionOptions, LongActionState } from '../interfaces/loading.interface';
import { AnnouncerService } from './announcer.service';

/**
 * A long action (signing, import, a document of many pages): the window that started it closes, the page shows the
 * loader with what is happening, and nothing can be clicked until it ends. When it fails the caller opens its window
 * again with everything the person entered and the reason — so the person loses nothing.
 *
 *   this.dialog.close();
 *   try { await this.longAction.run('Підписуємо 12 листів…', () => this.api.sign(ids), { hint: 'Не закривайте сторінку' }); }
 *   catch (err) { this.dialog.open({ ...draft, error: message(err) }); }
 */
@Injectable({ providedIn: 'root' })
export class LongActionService {
  private readonly announcer = inject(AnnouncerService);
  private readonly current = signal<LongActionState | null>(null);

  readonly state = this.current.asReadonly();

  async run<T>(label: string, work: () => Promise<T>, options: LongActionOptions = {}): Promise<T> {
    this.current.set({ label, hint: options.hint ?? '' });
    this.announcer.polite(label);
    try {
      const result = await work();
      if (options.doneMessage) this.announcer.polite(options.doneMessage);
      return result;
    } finally {
      this.current.set(null);
    }
  }
}

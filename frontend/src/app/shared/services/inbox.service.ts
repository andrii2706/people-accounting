import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { InboxItem, InboxView } from '../interfaces/inbox.interface';

/** In-app notifications about employees: the bell in the menu and the window after login. */
@Injectable({ providedIn: 'root' })
export class InboxService {
  private readonly http = inject(HttpClient);

  private readonly _items = signal<InboxItem[]>([]);
  private readonly _loaded = signal(false);

  readonly items = this._items.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly unread = computed(() => this._items().filter((i) => !i.read));
  readonly unreadCount = computed(() => this.unread().length);

  async load(): Promise<void> {
    try {
      const view = await firstValueFrom(this.http.get<InboxView>('/api/inbox'));
      this._items.set(view.items);
    } catch {
      // notifications are an extra — a failed request must not break the page
    } finally {
      this._loaded.set(true);
    }
  }

  async markRead(keys: string[]): Promise<void> {
    const unread = new Set(this.unread().map((i) => i.key));
    const todo = keys.filter((k) => unread.has(k));
    if (!todo.length) return;
    this.setRead(new Set(todo));
    await firstValueFrom(this.http.post<void>('/api/inbox/read', { keys: todo })).catch(
      () => undefined,
    );
  }

  async markAllRead(): Promise<void> {
    this.setRead(null);
    await firstValueFrom(this.http.post<void>('/api/inbox/read-all', {})).catch(() => undefined);
  }

  reset(): void {
    this._items.set([]);
    this._loaded.set(false);
  }

  /** Optimistic: the mark is shown at once, the request goes in the background. */
  private setRead(keys: Set<string> | null) {
    this._items.update((items) =>
      items.map((i) => (!keys || keys.has(i.key) ? { ...i, read: true } : i)),
    );
  }
}

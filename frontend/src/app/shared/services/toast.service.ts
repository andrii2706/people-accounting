import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(text: string) {
    this.push('success', text);
  }

  error(text: string) {
    this.push('error', text, 7000);
  }

  info(text: string) {
    this.push('info', text);
  }

  dismiss(id: number) {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], text: string, ttl = 4000) {
    const id = ++this.seq;
    this._toasts.update((list) => [...list, { id, kind, text }]);
    if (typeof window !== 'undefined') setTimeout(() => this.dismiss(id), ttl);
  }
}

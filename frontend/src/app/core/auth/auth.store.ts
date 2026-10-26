import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { AuthUser } from '../api/api.types';

/** Стан автентифікації на сигналах. Токен живе в httpOnly cookie — у JS його немає. */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _checked = signal(false);
  private pending: Promise<AuthUser | null> | null = null;

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');
  readonly initials = computed(() =>
    (this._user()?.fullName ?? '')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join(''),
  );

  /** Один запит /auth/session на застосунок (і на SSR-рендер; результат передається в браузер через TransferState). */
  ensureLoaded(): Promise<AuthUser | null> {
    if (this._checked()) return Promise.resolve(this._user());
    this.pending ??= firstValueFrom(this.http.get<{ user: AuthUser | null }>('/api/auth/session'))
      .then(({ user }) => {
        this._user.set(user);
        return user;
      })
      .catch(() => {
        this._user.set(null);
        return null;
      })
      .finally(() => {
        this._checked.set(true);
        this.pending = null;
      });
    return this.pending;
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const user = await firstValueFrom(this.http.post<AuthUser>('/api/auth/login', { email, password }));
    this._user.set(user);
    this._checked.set(true);
    return user;
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post<void>('/api/auth/logout', {})).catch(() => undefined);
    this._user.set(null);
    await this.router.navigateByUrl('/login');
  }
}

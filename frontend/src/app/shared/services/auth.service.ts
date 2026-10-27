import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { AuthUser } from '../interfaces/auth.interface';

/** Authentication state on signals. The session lives in an httpOnly cookie — JavaScript cannot see it. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _checked = signal(false);
  private pending: Promise<AuthUser | null> | null = null;

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');
  readonly mustChangePassword = computed(() => !!this._user()?.mustChangePassword);
  readonly initials = computed(() =>
    (this._user()?.fullName ?? '')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join(''),
  );

  /** One /auth/session request per app (and per SSR render; the result reaches the browser via TransferState). */
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
    const user = await firstValueFrom(
      this.http.post<AuthUser>('/api/auth/login', { email, password }),
    );
    this._user.set(user);
    this._checked.set(true);
    return user;
  }

  /** Change own password. Other sessions of the user are terminated on the server. */
  async changePassword(currentPassword: string, newPassword: string): Promise<AuthUser> {
    const user = await firstValueFrom(
      this.http.post<AuthUser>('/api/auth/change-password', { currentPassword, newPassword }),
    );
    this._user.set(user);
    return user;
  }

  /** The session ended on the server (idle timeout) — reset the state without a request. */
  markSignedOut() {
    this._user.set(null);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post<void>('/api/auth/logout', {})).catch(() => undefined);
    this._user.set(null);
    await this.router.navigateByUrl('/login');
  }
}

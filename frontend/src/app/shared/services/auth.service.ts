import { ENTITY_MANAGER_ROLES, ROLE_LABELS } from '../constants/auth.constants';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type {
  AuthUser,
  LogoutOptions,
  PasswordLinkInfo,
  SessionResponse,
} from '../interfaces/auth.interface';

/** Authentication state on signals. The session lives in an httpOnly cookie — JavaScript cannot see it. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _checked = signal(false);
  private pending: Promise<AuthUser | null> | null = null;
  /** Set by a sign-in with the password; the shell shows the new notifications once and clears it. */
  readonly justSignedIn = signal(false);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  /** The main administrator: all legal entities, system settings. */
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');
  readonly isDirector = computed(() => this._user()?.role === 'DIRECTOR');
  /** Runs a legal entity: its card, the access of its people, its accounts. */
  readonly isEntityManager = computed(() =>
    ENTITY_MANAGER_ROLES.includes(this._user()?.role ?? 'HR'),
  );
  /** Every staff role works with the registration data of its legal entity. */
  readonly canEdit = computed(() => {
    const role = this._user()?.role;
    return !!role && role !== 'VENDOR';
  });
  /** Not bound to a legal entity yet: the director adds his, the others wait for the main administrator. */
  readonly needsEntity = computed(() => {
    const u = this._user();
    return !!u && u.role !== 'ADMIN' && u.role !== 'VENDOR' && !u.legalEntityId;
  });
  /** A new legal entity: the main administrator, or the director while he has none. */
  readonly canAddEntity = computed(
    () => this.isAdmin() || (this.isDirector() && this.needsEntity()),
  );
  readonly roleLabel = computed(() => ROLE_LABELS[this._user()?.role ?? 'HR']);
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
    this.pending ??= firstValueFrom(this.http.get<SessionResponse>('/api/auth/session'))
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

  /** Reads the session again (e.g. the director has just added his legal entity). */
  async refresh(): Promise<AuthUser | null> {
    const { user } = await firstValueFrom(this.http.get<SessionResponse>('/api/auth/session'));
    this._user.set(user);
    return user;
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const user = await firstValueFrom(
      this.http.post<AuthUser>('/api/auth/login', { email, password }),
    );
    this._user.set(user);
    this._checked.set(true);
    this.justSignedIn.set(true);
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

  /** Who the link «set a new password» from a letter is for (400 — invalid / used / expired). */
  passwordLink(token: string) {
    return firstValueFrom(
      this.http.get<PasswordLinkInfo>(`/api/auth/password-reset/${encodeURIComponent(token)}`),
    );
  }

  /** A new password by the link from a letter; the server ends every session of the user. */
  async resetPassword(token: string, newPassword: string) {
    const result = await firstValueFrom(
      this.http.post<{ email: string }>('/api/auth/password-reset', { token, newPassword }),
    );
    this._user.set(null);
    return result;
  }

  /** The session ended on the server (idle timeout) — reset the state without a request. */
  markSignedOut() {
    this._user.set(null);
  }

  /** `reason: 'idle'` — signed out after inactivity: the login page explains it and returns to `returnUrl`. */
  async logout(opts: LogoutOptions = {}): Promise<void> {
    await firstValueFrom(this.http.post<void>('/api/auth/logout', {})).catch(() => undefined);
    this._user.set(null);
    const returnUrl = opts.returnUrl && opts.returnUrl !== '/' ? opts.returnUrl : undefined;
    await this.router.navigate(['/login'], {
      queryParams: opts.reason ? { reason: opts.reason, returnUrl } : {},
    });
  }
}

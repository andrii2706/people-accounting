import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ManagedUser, UserRole } from '../interfaces/auth.interface';

/** Account management (administrators only). */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<ManagedUser[]>('/api/users');
  }

  create(body: { email: string; fullName: string; password: string; role: UserRole }) {
    return firstValueFrom(this.http.post<ManagedUser>('/api/users', body));
  }

  update(id: string, body: { isActive?: boolean; role?: UserRole; fullName?: string }) {
    return firstValueFrom(this.http.patch<ManagedUser>(`/api/users/${id}`, body));
  }

  /** The temporary password is returned once. */
  resetPassword(id: string) {
    return firstValueFrom(
      this.http.post<{ temporaryPassword: string }>(`/api/users/${id}/reset-password`, {}),
    );
  }

  unlock(id: string) {
    return firstValueFrom(this.http.post<ManagedUser>(`/api/users/${id}/unlock`, {}));
  }
}

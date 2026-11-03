import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  CreateUserRequest,
  ManagedUser,
  PasswordResetResult,
  UpdateUserRequest,
} from '../interfaces/auth.interface';

/** Account management (administrators only). */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<ManagedUser[]>('/api/users');
  }

  create(body: CreateUserRequest) {
    return firstValueFrom(this.http.post<ManagedUser>('/api/users', body));
  }

  update(id: string, body: UpdateUserRequest) {
    return firstValueFrom(this.http.patch<ManagedUser>(`/api/users/${id}`, body));
  }

  /** The temporary password is returned once. */
  resetPassword(id: string) {
    return firstValueFrom(
      this.http.post<PasswordResetResult>(`/api/users/${id}/reset-password`, {}),
    );
  }

  unlock(id: string) {
    return firstValueFrom(this.http.post<ManagedUser>(`/api/users/${id}/unlock`, {}));
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  CreateUserRequest,
  ManagedUser,
  PasswordChangeRequestResult,
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
  /** Letter «change your password» with a link; until changed the user gets only the password page. */
  requestPasswordChange(id: string) {
    return firstValueFrom(
      this.http.post<PasswordChangeRequestResult>(`/api/users/${id}/password-change-request`, {}),
    );
  }

  resetPassword(id: string) {
    return firstValueFrom(
      this.http.post<PasswordResetResult>(`/api/users/${id}/reset-password`, {}),
    );
  }

  unlock(id: string) {
    return firstValueFrom(this.http.post<ManagedUser>(`/api/users/${id}/unlock`, {}));
  }
}

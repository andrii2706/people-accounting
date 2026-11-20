import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { TwoFactorSetup } from '../../../platform/contracts/session';
import type { MfaCodesResult, MfaStatus } from '../interfaces/auth.interface';

/** One's own code from the app: on, off, new recovery codes (Profile). */
@Injectable({ providedIn: 'root' })
export class TwoFactorService {
  private readonly http = inject(HttpClient);

  status() {
    return firstValueFrom(this.http.get<MfaStatus>('api/auth/mfa'));
  }

  /** A new secret — the password once more first. */
  setup(password: string) {
    return firstValueFrom(this.http.post<TwoFactorSetup>('api/auth/mfa/setup', { password }));
  }

  enable(code: string) {
    return firstValueFrom(this.http.post<MfaCodesResult>('api/auth/mfa/enable', { code }));
  }

  disable(password: string, code: string) {
    return firstValueFrom(this.http.post<MfaStatus>('api/auth/mfa/disable', { password, code }));
  }

  renewCodes(password: string, code: string) {
    return firstValueFrom(
      this.http.post<MfaCodesResult>('api/auth/mfa/recovery-codes', { password, code }),
    );
  }
}

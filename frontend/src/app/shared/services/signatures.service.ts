import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, type Observable, shareReplay } from 'rxjs';
import type {
  LetterSignature,
  SignatureMethod,
  SigningConfig,
  SigningState,
} from '../interfaces/signature.interface';

/** Qualified e-signing of letters: freezing the document, uploading signatures, package for the TCK. */
@Injectable({ providedIn: 'root' })
export class SignaturesService {
  private readonly http = inject(HttpClient);
  private config$?: Observable<SigningConfig>;

  /** Settings do not change at runtime — cached for the whole session. */
  config() {
    this.config$ ??= this.http
      .get<SigningConfig>('/api/signatures/config')
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.config$;
  }

  state(letterId: string) {
    return this.http.get<SigningState>(`/api/letters/${letterId}/signatures`);
  }

  freeze(letterId: string) {
    return firstValueFrom(this.http.post<SigningState>(`/api/letters/${letterId}/freeze`, {}));
  }

  unfreeze(letterId: string) {
    return firstValueFrom(this.http.delete<SigningState>(`/api/letters/${letterId}/freeze`));
  }

  /** Bytes of the frozen document — exactly what the widget signs. */
  signingFile(letterId: string) {
    return firstValueFrom(
      this.http.get(`/api/letters/${letterId}/signing-file`, { responseType: 'arraybuffer' }),
    );
  }

  add(letterId: string, signatureBase64: string, method: SignatureMethod) {
    return firstValueFrom(
      this.http.post<LetterSignature>(`/api/letters/${letterId}/signatures`, {
        signature: signatureBase64,
        method,
      }),
    );
  }

  signingFileUrl(letterId: string) {
    return `/api/letters/${letterId}/signing-file`;
  }

  signatureFileUrl(letterId: string, signatureId: string) {
    return `/api/letters/${letterId}/signatures/${signatureId}/file`;
  }

  packageUrl(letterId: string) {
    return `/api/letters/${letterId}/signed-package`;
  }
}

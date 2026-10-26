import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, type Observable, shareReplay } from 'rxjs';
import type {
  LetterSignature,
  SignatureMethod,
  SigningConfig,
  SigningState,
} from '../interfaces/signature.interface';

/** Підписання листів КЕП: фіксація документа, завантаження підписів, пакет для ТЦК. */
@Injectable({ providedIn: 'root' })
export class SignaturesService {
  private readonly http = inject(HttpClient);
  private config$?: Observable<SigningConfig>;

  /** Налаштування не змінюються під час роботи — кешуємо на всю сесію. */
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

  /** Байти зафіксованого документа — саме їх підписує віджет. */
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

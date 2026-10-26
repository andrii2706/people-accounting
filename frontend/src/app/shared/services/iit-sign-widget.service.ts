import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

/**
 * Адаптер до віджета підпису ІІТ («Віджет підпису», бібліотека eusign.js).
 *
 * Віджет відкривається у фреймі з сайту ІІТ і сам працює з ключем — застосунок
 * не бачить ні файлу ключа, ні пароля. Підтримує:
 *  • файлові ключі (Key-6.dat, *.pfx, *.jks) будь-якого кваліфікованого надавача;
 *  • апаратні носії («Алмаз-1К», «Кристал-1», SecureToken…) через агента ІІТ;
 *  • хмарні КЕП (Дія.Підпис, SmartID, Вчасно.КЕП, CloudKey тощо — перелік визначає ІІТ).
 *
 * Скрипт eusign.js розміщуємо у себе (public/iit/eusign.js) — його видає ІІТ разом із віджетом.
 * Адреси задаються на бекенді (SIGN_WIDGET_SCRIPT_URL, SIGN_WIDGET_FRAME_URL), тож оновлення
 * версії віджета не потребує перезбирання фронтенду.
 *
 * ⚠️ API віджета належить ІІТ і може змінюватися між версіями — при оновленні перевірте
 * назви констант (EndUser.FormType / SignAlgo / SignType) у документації до нової версії.
 */

/** Мінімальний опис API EndUser з eusign.js, який ми використовуємо. */
interface EndUserCertificate {
  infoEx?: { publicKeyType?: number; keyUsageType?: number };
}
interface EndUserInstance {
  ReadPrivateKey(): Promise<EndUserCertificate[]>;
  SignData(
    data: Uint8Array,
    external: boolean,
    asBase64String: boolean,
    signAlgo?: number,
    previousSign?: string | null,
    signType?: number,
  ): Promise<string>;
  ResetPrivateKey?(): Promise<void>;
  destroy?(): void;
}
interface EndUserConstructor {
  new (
    parentId: string,
    id: string,
    src: string,
    formType: number,
    formParams?: unknown,
  ): EndUserInstance;
  FormType?: Record<string, number>;
  SignAlgo?: Record<string, number>;
  SignType?: Record<string, number>;
}

/** Типи відкритого ключа в сертифікаті (EU_CERT_KEY_TYPE_*). */
const KEY_TYPE = { DSTU4145: 1, RSA: 2, ECDSA: 4 } as const;
/** EU_KEY_USAGE_DIGITAL_SIGNATURE — сертифікат для підпису (не для шифрування). */
const KEY_USAGE_SIGNATURE = 1;

@Injectable({ providedIn: 'root' })
export class IitSignWidgetService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private scriptPromise: Promise<EndUserConstructor> | null = null;
  private instance: EndUserInstance | null = null;
  private certificates: EndUserCertificate[] = [];

  private loadScript(url: string): Promise<EndUserConstructor> {
    if (!this.isBrowser) return Promise.reject(new Error('Віджет працює лише в браузері'));
    const win = this.document.defaultView as unknown as { EndUser?: EndUserConstructor };
    if (win.EndUser) return Promise.resolve(win.EndUser);
    this.scriptPromise ??= new Promise<EndUserConstructor>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () =>
        win.EndUser
          ? resolve(win.EndUser)
          : reject(new Error('Скрипт віджета завантажено, але EndUser не знайдено'));
      script.onerror = () => {
        this.scriptPromise = null;
        reject(new Error(`Не вдалося завантажити бібліотеку підпису (${url})`));
      };
      this.document.head.appendChild(script);
    });
    return this.scriptPromise;
  }

  /**
   * Показати віджет у контейнері `parentId` і дочекатися, поки користувач зчитає ключ.
   * Повертає, коли ключ зчитано (пароль вводиться у фреймі ІІТ).
   */
  async readKey(parentId: string, scriptUrl: string, frameUrl: string): Promise<void> {
    const EndUser = await this.loadScript(scriptUrl);
    this.close();
    const formType = EndUser.FormType?.['ReadPKey'] ?? 1;
    this.instance = new EndUser(parentId, `${parentId}-frame`, frameUrl, formType);
    this.certificates = (await this.instance.ReadPrivateKey()) ?? [];
  }

  /** Окремий (detached) підпис CAdES у base64 для байтів документа. */
  async signDetached(data: Uint8Array): Promise<string> {
    if (!this.instance) throw new Error('Спершу зчитайте ключ');
    const EndUser = (this.document.defaultView as unknown as { EndUser: EndUserConstructor })
      .EndUser;
    const signing =
      this.certificates.find((c) => (c.infoEx?.keyUsageType ?? 0) & KEY_USAGE_SIGNATURE) ??
      this.certificates[0];
    const keyType = signing?.infoEx?.publicKeyType ?? KEY_TYPE.DSTU4145;
    const algo = EndUser.SignAlgo ?? {};
    const signAlgo =
      keyType === KEY_TYPE.ECDSA
        ? (algo['ECDSAWithSHA'] ?? 3)
        : keyType === KEY_TYPE.RSA
          ? (algo['RSAWithSHA'] ?? 2)
          : (algo['DSTU4145WithGOST34311'] ?? 1);
    // CAdES-X Long: підпис + позначка часу + дані про статус сертифіката — придатний для архіву
    const signType = EndUser.SignType?.['CAdES_X_Long'];
    return this.instance.SignData(data, true, true, signAlgo, null, signType);
  }

  close() {
    try {
      this.instance?.destroy?.();
    } catch {
      /* фрейм уже прибрано */
    }
    this.instance = null;
    this.certificates = [];
  }
}

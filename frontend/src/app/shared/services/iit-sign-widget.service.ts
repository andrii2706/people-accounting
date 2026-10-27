import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

/**
 * Adapter for the IIT signing widget («Віджет підпису», eusign.js library).
 *
 * The widget opens in a frame from the IIT site and works with the key itself — the app
 * never sees the key file or the password. It supports:
 *  • file keys (Key-6.dat, *.pfx, *.jks) of any qualified provider;
 *  • hardware tokens («Алмаз-1К», «Кристал-1», SecureToken…) via the IIT agent;
 *  • cloud e-signatures (Diia.Pidpys, SmartID, Vchasno.KEP, CloudKey etc. — the list is defined by IIT).
 *
 * We host eusign.js ourselves (public/iit/eusign.js) — IIT ships it together with the widget.
 * The URLs are configured on the backend (SIGN_WIDGET_SCRIPT_URL, SIGN_WIDGET_FRAME_URL), so updating
 * the widget version does not require rebuilding the frontend.
 *
 * ⚠️ The widget API belongs to IIT and may change between versions — when updating, check
 * the constant names (EndUser.FormType / SignAlgo / SignType) in the documentation of the new version.
 */

/** Minimal description of the EndUser API from eusign.js that we use. */
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

/** Public key types in a certificate (EU_CERT_KEY_TYPE_*). */
const KEY_TYPE = { DSTU4145: 1, RSA: 2, ECDSA: 4 } as const;
/** EU_KEY_USAGE_DIGITAL_SIGNATURE — a signing certificate (not an encryption one). */
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
   * Show the widget in the `parentId` container and wait until the user reads the key.
   * Resolves once the key is read (the password is typed inside the IIT frame).
   */
  async readKey(parentId: string, scriptUrl: string, frameUrl: string): Promise<void> {
    const EndUser = await this.loadScript(scriptUrl);
    this.close();
    const formType = EndUser.FormType?.['ReadPKey'] ?? 1;
    this.instance = new EndUser(parentId, `${parentId}-frame`, frameUrl, formType);
    this.certificates = (await this.instance.ReadPrivateKey()) ?? [];
  }

  /** Detached CAdES signature in base64 for the document bytes. */
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
    // CAdES-X Long: signature + timestamp + certificate status data — suitable for archiving
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

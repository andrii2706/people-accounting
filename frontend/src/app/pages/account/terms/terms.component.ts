import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { KepSignComponent } from '../../../shared/components/kep-sign/kep-sign.component';
import { TermsDocumentComponent } from '../../../shared/components/terms-document/terms-document.component';
import type {
  OfferDocument,
  OfferPageData,
} from '../../../shared/interfaces/subscription.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { AccountService } from '../../../shared/services/account.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';

/**
 * The offer: accepted only when the head of the legal entity signs the acceptance document with KEP.
 * The director / the entity admin forms the document and adds the head's signature; the other users wait.
 */
@Component({
  selector: 'app-terms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TermsDocumentComponent, KepSignComponent, UaDateTimePipe],
  templateUrl: './terms.component.html',
})
export class TermsComponent {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly refresh = injectRouteRefresh();
  protected readonly auth = inject(AuthService);

  /** termsResolver */
  readonly data = input.required<OfferPageData>();

  protected readonly document = signal<OfferDocument | null>(null);
  protected readonly forming = signal(false);
  protected readonly checking = signal(false);

  protected async form() {
    this.forming.set(true);
    try {
      this.document.set(await this.account.offerDocument());
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося сформувати документ'));
    } finally {
      this.forming.set(false);
    }
  }

  protected async onSigned(signature: string) {
    const doc = this.document();
    if (!doc || this.checking()) return;
    this.checking.set(true);
    try {
      await this.account.signOffer(doc.id, signature);
      this.toast.success('Оферту підписано КЕП керівника');
      this.document.set(null);
      await this.auth.refresh();
      this.account.forget();
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Підпис не прийнято'));
    } finally {
      this.checking.set(false);
    }
  }

  /** Someone else may have signed meanwhile (the HR waits for the head). */
  protected async check() {
    await this.auth.refresh();
    if (this.auth.user()?.termsAccepted) await this.router.navigateByUrl('/');
    else await this.refresh();
  }
}

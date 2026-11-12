import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CopyrightComponent } from '../../../shared/components/copyright/copyright.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { TermsDocumentComponent } from '../../../shared/components/terms-document/terms-document.component';
import { AccountService } from '../../../shared/services/account.service';

/** The public offer — open without signing in (the link from the sign-up form). */
@Component({
  selector: 'app-offer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, TermsDocumentComponent, CopyrightComponent],
  templateUrl: './offer.component.html',
})
export class OfferComponent {
  private readonly account = inject(AccountService);
  protected readonly doc = rxResource({ stream: () => this.account.terms() });
}

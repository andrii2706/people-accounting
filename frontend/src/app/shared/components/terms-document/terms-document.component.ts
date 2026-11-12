import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TermsDocument } from '../../interfaces/subscription.interface';

/** The text of the agreement: the title, the sections and the requisites of the seller. */
@Component({
  selector: 'app-terms-document',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms-document.component.html',
})
export class TermsDocumentComponent {
  readonly doc = input.required<TermsDocument>();

  /** The requisites that are filled — empty lines are not printed. */
  protected readonly sellerLines = computed(() => {
    const s = this.doc().seller;
    return [
      s.name,
      s.code ? `Код за ЄДРПОУ ${s.code}` : '',
      s.ipn ? `ІПН ${s.ipn}` : '',
      s.address,
      s.iban ? `IBAN ${s.iban}${s.bank ? `, ${s.bank}` : ''}` : '',
      [s.phone, s.email].filter(Boolean).join(', '),
      s.taxNote,
    ].filter(Boolean);
  });
}

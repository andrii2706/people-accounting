import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { DictionariesService } from '../../services/dictionaries.service';
import { SelectComponent } from '../select/select.component';

/**
 * Legal entity choice for lists, reports and extracts. Shown only when there are several legal entities:
 * with one, everything belongs to it and there is nothing to choose.
 */
@Component({
  selector: 'app-legal-entity-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectComponent],
  template: `
    @if (dict.severalLegalEntities()) {
      <app-select
        class="w-64"
        ariaLabel="Юридична особа"
        [placeholder]="placeholder()"
        [options]="dict.legalEntityOptions()"
        [clearable]="clearable()"
        [value]="value()"
        (valueChange)="changed.emit($event)"
      />
    }
  `,
})
export class LegalEntityFilterComponent {
  protected readonly dict = inject(DictionariesService);
  readonly value = input('');
  readonly placeholder = input('Усі юридичні особи');
  readonly clearable = input(true);
  readonly changed = output<string>();
}

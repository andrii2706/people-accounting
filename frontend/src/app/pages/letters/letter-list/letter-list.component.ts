import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LetterStatusBadgeComponent } from '../../../shared/components/letter-status-badge/letter-status-badge.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LETTER_TYPE_LABELS } from '../../../shared/constants/letter.constants';
import type { Letter, LetterStatus, LetterType } from '../../../shared/interfaces/letter.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { LettersService } from '../../../shared/services/letters.service';
import { injectQueryParamsUpdate } from '../../../shared/utils/router.utils';

@Component({
  selector: 'app-letter-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, RouterLink, LetterStatusBadgeComponent, UaDatePipe, IconComponent],
  templateUrl: './letter-list.component.html',
})
export class LetterListComponent {
  protected readonly lettersService = inject(LettersService);
  private readonly updateQuery = injectQueryParamsUpdate();

  /** Дані з letterListResolver. */
  readonly letters = input.required<Letter[]>();
  /** Фільтри з query-параметрів (?type=…&status=…). */
  readonly type = input<LetterType | ''>('');
  readonly status = input<LetterStatus | ''>('');

  protected readonly typeOptions = (Object.keys(LETTER_TYPE_LABELS) as LetterType[]).map(
    (value) => ({ value, label: LETTER_TYPE_LABELS[value] }),
  );

  protected setType(type: string) {
    void this.updateQuery({ type });
  }

  protected setStatus(status: string) {
    void this.updateQuery({ status });
  }

  protected typeLabel(type: LetterType) {
    return LETTER_TYPE_LABELS[type];
  }
}

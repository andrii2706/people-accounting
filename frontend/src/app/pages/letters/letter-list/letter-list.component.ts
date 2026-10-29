import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LetterStatusBadgeComponent } from '../../../shared/components/letter-status-badge/letter-status-badge.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LETTER_TYPE_LABELS } from '../../../shared/constants/letter.constants';
import type { Letter, LetterStatus, LetterType } from '../../../shared/interfaces/letter.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { LettersService } from '../../../shared/services/letters.service';
import { injectQueryParamsUpdate } from '../../../shared/utils/router.utils';
import {
  type SelectOption,
  SelectComponent,
} from '../../../shared/components/select/select.component';

@Component({
  selector: 'app-letter-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SelectComponent,
    PageHeaderComponent,
    RouterLink,
    LetterStatusBadgeComponent,
    UaDatePipe,
    IconComponent,
  ],
  templateUrl: './letter-list.component.html',
})
export class LetterListComponent {
  protected readonly lettersService = inject(LettersService);
  private readonly updateQuery = injectQueryParamsUpdate();

  /** Data from letterListResolver. */
  readonly letters = input.required<Letter[]>();
  /** Filters from query parameters (?type=…&status=…). */
  readonly type = input<LetterType | '', LetterType | '' | undefined>('', {
    transform: (v) => v ?? '',
  });
  readonly status = input<LetterStatus | '', LetterStatus | '' | undefined>('', {
    transform: (v) => v ?? '',
  });

  protected readonly typeOptions = (Object.keys(LETTER_TYPE_LABELS) as LetterType[]).map(
    (value) => ({ value, label: LETTER_TYPE_LABELS[value] }),
  );

  /** Letters selected for envelope labels; reset whenever the list is reloaded. */
  protected readonly selected = linkedSignal<Letter[], ReadonlySet<string>>({
    source: this.letters,
    computation: () => new Set(),
  });
  protected readonly selectedIds = computed(() => [...this.selected()]);
  protected readonly allSelected = computed(
    () => this.letters().length > 0 && this.selected().size === this.letters().length,
  );

  protected toggle(id: string, checked: boolean) {
    this.selected.update((set) => {
      const next = new Set(set);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected toggleAll(checked: boolean) {
    this.selected.set(checked ? new Set(this.letters().map((l) => l.id)) : new Set());
  }

  protected readonly statusOptions: SelectOption[] = [
    { value: 'DRAFT', label: 'Чернетки' },
    { value: 'SENT', label: 'Надіслані' },
  ];

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

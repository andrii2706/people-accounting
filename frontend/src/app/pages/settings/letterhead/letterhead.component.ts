import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { LABEL_FONT_OPTIONS } from '../../../shared/constants/label-settings.constants';
import {
  DEFAULT_LETTERHEAD_SETTINGS,
  LETTERHEAD_ALIGN_OPTIONS,
  LETTERHEAD_LIMITS,
  LETTERHEAD_PREVIEW,
  LETTERHEAD_TEXT_SIZES,
  LETTERHEAD_TITLE_OPTIONS,
  LETTERHEAD_TITLE_SIZES,
} from '../../../shared/constants/letterhead.constants';
import type { LabelFont } from '../../../shared/interfaces/label-settings.interface';
import type {
  LetterheadPageData,
  LetterheadSettings,
} from '../../../shared/interfaces/letterhead.interface';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import {
  letterheadAddress,
  letterheadCode,
  letterheadContent,
  letterheadRows,
  missingRequisites,
} from '../../../shared/utils/letterhead.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import { UiBusyDirective } from '@mr/ui';

/** The checkboxes of the requisites. */
type RequisiteToggle = 'showAddress' | 'showCode' | 'showPhone' | 'showEmail';

/** Millimetres → CSS pixels (96 dpi). */
const PX_PER_MM = 96 / 25.4;
/** Points → CSS pixels. */
const PX_PER_PT = 96 / 72;

/**
 * The letterhead (бланк) of the letters of a legal entity: what it shows and how. The values — the name, the
 * address, the code, the phone, the email — come from the requisites of the legal entity when a letter is made,
 * so the page only chooses; the preview is the top of a real letter.
 */
@Component({
  selector: 'app-letterhead',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiBusyDirective,
    FormFieldComponent,
    IconComponent,
    PageHeaderComponent,
    RouterLink,
    SelectComponent,
  ],
  templateUrl: './letterhead.component.html',
})
export class LetterheadComponent {
  private readonly service = inject(LegalEntitiesService);
  private readonly toast = inject(ToastService);
  private readonly refresh = injectRouteRefresh();

  /** letterheadResolver */
  readonly data = input.required<LetterheadPageData>();

  protected readonly fonts = LABEL_FONT_OPTIONS;
  protected readonly titles = LETTERHEAD_TITLE_OPTIONS;
  protected readonly aligns = LETTERHEAD_ALIGN_OPTIONS;
  protected readonly titleSizes = LETTERHEAD_TITLE_SIZES;
  protected readonly textSizes = LETTERHEAD_TEXT_SIZES;
  protected readonly limits = LETTERHEAD_LIMITS;

  protected readonly model = linkedSignal<LetterheadSettings>(() => ({ ...this.data().settings }));
  protected readonly saving = signal(false);
  protected readonly touched = signal(false);

  protected readonly org = computed(() => this.data().requisites);
  /** The values of the checkboxes: what each requisite will print. */
  protected readonly values = computed(() => {
    const o = this.org();
    return {
      address: letterheadAddress(o.address, o.postalCode),
      code: letterheadCode(o.edrpou),
      phone: o.phone.trim(),
      email: o.email.trim(),
    };
  });
  /** The requisites to show or not, with what each will print. */
  protected readonly requisiteRows = computed(() => {
    const v = this.values();
    const rows: { key: RequisiteToggle; label: string; value: string }[] = [
      { key: 'showAddress', label: 'Адреса з індексом', value: v.address },
      { key: 'showCode', label: 'Код ЄДР', value: v.code },
      { key: 'showPhone', label: 'Телефон', value: v.phone },
      { key: 'showEmail', label: 'Email', value: v.email },
    ];
    return rows;
  });
  protected readonly content = computed(() => letterheadContent(this.org(), this.model()));
  protected readonly rows = computed(() => letterheadRows(this.content()));
  protected readonly missing = computed(() => missingRequisites(this.org(), this.model()));
  protected readonly customProblem = computed(() =>
    this.model().title === 'CUSTOM' && !this.model().customTitle.trim()
      ? 'Вкажіть назву для бланка'
      : '',
  );

  /** The preview: the top of an A4 letter at its real size, scaled to the room on the screen. */
  protected readonly pageWidthPx = LETTERHEAD_PREVIEW.widthMm * PX_PER_MM;
  protected readonly padding = {
    left: LETTERHEAD_PREVIEW.leftMm * PX_PER_MM,
    right: LETTERHEAD_PREVIEW.rightMm * PX_PER_MM,
    top: LETTERHEAD_PREVIEW.topMm * PX_PER_MM,
  };
  /** The part of the sheet shown: the letterhead, the number of the letter, the first lines. */
  protected readonly previewHeightPx = 300;
  protected readonly px = (pt: number) => pt * PX_PER_PT;
  protected readonly fontFamily = computed(
    () => `'${this.model().font}', ${this.fallback(this.model().font)}`,
  );

  protected set<K extends keyof LetterheadSettings>(key: K, value: LetterheadSettings[K]) {
    this.model.update((m) => ({ ...m, [key]: value }));
  }

  protected setFont(value: string) {
    if (value) this.set('font', value as LabelFont);
  }

  protected setSize(key: 'titleSize' | 'textSize', value: string) {
    const n = Number(value);
    if (n) this.set(key, n);
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected resetDefaults() {
    this.model.set({ ...DEFAULT_LETTERHEAD_SETTINGS });
    this.toast.info('Повернуто стандартний бланк — збережіть, щоб він діяв');
  }

  protected async save(event: Event) {
    event.preventDefault();
    this.touched.set(true);
    if (this.customProblem()) {
      this.toast.error(this.customProblem());
      return;
    }
    this.saving.set(true);
    try {
      await this.service.saveLetterhead(this.data().entityId, this.model());
      this.toast.success('Бланк листа збережено');
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося зберегти бланк'));
    } finally {
      this.saving.set(false);
    }
  }

  /** A font the screen may not have — a look-alike in its place. */
  private fallback(font: LabelFont): string {
    if (font === 'Times New Roman') return "'Tinos', 'Liberation Serif', Georgia, serif";
    if (font === 'Courier New') return "'Cousine', 'Liberation Mono', monospace";
    return "'Arimo', 'Liberation Sans', Helvetica, sans-serif";
  }
}

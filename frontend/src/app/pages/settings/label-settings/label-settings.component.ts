import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import {
  form,
  FormField,
  max,
  min,
  required,
  type SchemaPath,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LabelSheetComponent } from '../../../shared/components/label-sheet/label-sheet.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import {
  DEFAULT_LABEL_SETTINGS,
  ENVELOPE_OPTIONS,
  ENVELOPE_SIZES,
  LABEL_ALIGN_OPTIONS,
  LABEL_COLUMN_OPTIONS,
  LABEL_FONT_OPTIONS,
  LABEL_GEOMETRY_FIELDS,
  LABEL_LAYOUT_OPTIONS,
  LABEL_MODE_OPTIONS,
  LABEL_NUMBER_RULES,
  LABEL_PREVIEW_WIDTH_PX,
  PX_PER_MM,
} from '../../../shared/constants/label-settings.constants';
import type {
  EnvelopeFormat,
  LabelPage,
  LabelSettings,
  LabelSettingsPageData,
  LabelTestPrintState,
} from '../../../shared/interfaces/label-settings.interface';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import { ToastService } from '../../../shared/services/toast.service';
import { formSubmitErrors } from '../../../shared/utils/api-error.utils';
import {
  labelSettingsProblems,
  labelsPerPage,
  pageSize,
  rowsPerPage,
  withEnvelope,
} from '../../../shared/utils/label-settings.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';

/**
 * Envelope labels of a legal entity: A4 sheet or the envelope itself, the font, the sizes, the lines,
 * the places in millimetres — with a live preview and a test print from the browser.
 */
@Component({
  selector: 'app-label-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    FormField,
    FormFieldComponent,
    IconComponent,
    LabelSheetComponent,
    SelectComponent,
    RouterLink,
  ],
  templateUrl: './label-settings.component.html',
})
export class LabelSettingsComponent {
  private readonly service = inject(LegalEntitiesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly refresh = injectRouteRefresh();
  private readonly notifyError = (message: string) => this.toast.error(message);

  /** labelSettingsResolver */
  readonly data = input.required<LabelSettingsPageData>();

  protected readonly modes = LABEL_MODE_OPTIONS;
  protected readonly fonts = LABEL_FONT_OPTIONS;
  protected readonly envelopes = ENVELOPE_OPTIONS;
  protected readonly layouts = LABEL_LAYOUT_OPTIONS;
  protected readonly aligns = LABEL_ALIGN_OPTIONS;
  protected readonly columnOptions = LABEL_COLUMN_OPTIONS;

  protected readonly model = linkedSignal<LabelSettings>(() => ({ ...this.data().settings }));
  protected readonly problems = computed(() => labelSettingsProblems(this.model()));

  protected readonly labelForm = form(this.model, (p) => {
    for (const [key, lo, hi, unit] of LABEL_NUMBER_RULES) {
      const path = p[key] as SchemaPath<number>;
      const suffix = unit ? ` ${unit}` : '';
      required(path, { message: 'Вкажіть число' });
      min(path, lo, { message: `Не менше ${lo}${suffix}` });
      max(path, hi, { message: `Не більше ${hi}${suffix}` });
    }
    for (const key of LABEL_GEOMETRY_FIELDS) {
      validate(p[key] as SchemaPath<number>, () => {
        const problem = this.problems().find((x) => x.field === key);
        return problem ? { kind: 'geometry', message: problem.message } : undefined;
      });
    }
  });

  /** Of the current settings: the A4 sheet or the envelope. */
  protected readonly paper = computed(() => pageSize(this.model()));
  protected readonly perPage = computed(() => labelsPerPage(this.model()));
  protected readonly rows = computed(() => rowsPerPage(this.model()));
  protected readonly envelopeSize = computed(() => ENVELOPE_SIZES[this.model().envelope]);

  /** The preview: the first page, the label of this entity repeated as many times as fit. */
  protected readonly previewPages = computed<LabelPage[]>(() => [
    {
      group: 0,
      settings: this.model(),
      labels: Array.from({ length: this.perPage() }, () => this.data().sample),
    },
  ]);
  /** Room for the preview: at most LABEL_PREVIEW_WIDTH_PX, narrower on a phone. */
  private readonly previewBox = viewChild<ElementRef<HTMLElement>>('previewBox');
  private readonly room = signal(LABEL_PREVIEW_WIDTH_PX);
  protected readonly scale = computed(
    () => this.room() / (Math.max(this.paper().widthMm, 1) * PX_PER_MM),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const box = this.previewBox()?.nativeElement;
      if (!box || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) =>
        this.room.set(Math.min(LABEL_PREVIEW_WIDTH_PX, Math.floor(entry.contentRect.width))),
      );
      observer.observe(box);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
  protected readonly previewWidth = computed(() => this.paper().widthMm * PX_PER_MM * this.scale());
  protected readonly previewHeight = computed(
    () => this.paper().heightMm * PX_PER_MM * this.scale(),
  );

  protected set<K extends keyof LabelSettings>(key: K, value: LabelSettings[K]) {
    this.model.update((m) => ({ ...m, [key]: value }));
  }

  protected setEnvelope(value: string) {
    if (value) this.model.update((m) => withEnvelope(m, value as EnvelopeFormat));
  }

  protected resetDefaults() {
    this.model.set({ ...DEFAULT_LABEL_SETTINGS });
    this.toast.info('Повернуто стандартні налаштування — збережіть, щоб вони діяли');
  }

  protected async save(event: Event) {
    event.preventDefault();
    await submit(this.labelForm, async () => {
      try {
        await this.service.saveLabelSettings(this.data().entityId, this.numeric(this.model()));
        this.toast.success('Налаштування наклейок збережено');
        await this.refresh();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.labelForm, this.notifyError);
      }
    });
  }

  /** A full page of the label of this entity with the settings on the screen (saved or not). */
  protected testPrint() {
    if (this.labelForm().invalid()) {
      this.toast.error('Спершу виправте позначені поля');
      return;
    }
    const state: LabelTestPrintState = {
      labelTestPrint: {
        legalEntityId: this.data().entityId,
        settings: this.numeric(this.model()),
        labels: Array.from({ length: this.perPage() }, () => this.data().sample),
      },
      back: this.router.url,
    };
    void this.router.navigate(['/print/labels'], { state });
  }

  /** Inputs of type number may give strings — the server expects numbers. */
  private numeric(s: LabelSettings): LabelSettings {
    const out = { ...s } as Record<string, unknown>;
    for (const [key] of LABEL_NUMBER_RULES) out[key] = Number(s[key]);
    return out as unknown as LabelSettings;
  }
}

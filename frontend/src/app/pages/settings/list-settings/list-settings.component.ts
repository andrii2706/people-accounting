import { ConfirmService } from '../../../shared/services/confirm.service';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { applyEach, form, FormField, maxLength, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { SortableListComponent } from '../../../shared/components/sortable-list/sortable-list.component';
import {
  LIST_COLUMN_OPTIONS,
  LIST_GROUPING_OPTIONS,
  LIST_SECTION_TABS,
  LIST_SORT_OPTIONS,
  MAX_LIST_SIGNERS,
  MAX_LIST_SUBTITLE,
  MAX_LIST_TITLE,
  MAX_TEMPLATE_BYTES,
} from '../../../shared/constants/list-settings.constants';
import type { ListSection } from '../../../shared/interfaces/dictionary.interface';
import type {
  ListColumnKey,
  ListGrouping,
  ListSectionSettingsBody,
  ListSettings,
  ListSettingsPageData,
  ListSort,
} from '../../../shared/interfaces/list-settings.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { ListsService } from '../../../shared/services/lists.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import {
  columnItems,
  fileSize,
  sectionBody,
  toggleColumn,
  withNumberFirst,
} from '../../../shared/utils/list-settings.utils';
import { MESSAGE } from '../../../shared/validators/employee-rules';

/**
 * How the four lists of a legal entity look in the documents: the columns and their order, the order of the
 * rows and sub-headings, the heading and the signers — and an own Word template for each list.
 */
@Component({
  selector: 'app-list-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    IconComponent,
    RouterLink,
    FormField,
    FormFieldComponent,
    SelectComponent,
    SortableListComponent,
    UaDateTimePipe,
  ],
  templateUrl: './list-settings.component.html',
})
export class ListSettingsComponent {
  private readonly dialogs = inject(ConfirmService);
  private readonly service = inject(ListsService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  private readonly notifyError = (message: string) => this.toast.error(message);

  /** listSettingsResolver */
  readonly data = input.required<ListSettingsPageData>();

  protected readonly tabs = LIST_SECTION_TABS;
  protected readonly columnOptions = LIST_COLUMN_OPTIONS;
  protected readonly sortOptions = LIST_SORT_OPTIONS;
  protected readonly groupingOptions = LIST_GROUPING_OPTIONS;
  protected readonly maxSigners = MAX_LIST_SIGNERS;
  protected readonly fileSize = fileSize;

  protected readonly section = signal<ListSection>('OFFICERS');
  /** Saved settings: replaced by what the server returns after each change. */
  protected readonly settings = linkedSignal<ListSettings>(() => this.data().settings);
  protected readonly current = computed(() => this.settings()[this.section()]);
  protected readonly template = computed(() => this.current().template);

  protected readonly model = linkedSignal<ListSectionSettingsBody>(() =>
    sectionBody(this.current()),
  );
  protected readonly settingsForm = form(this.model, (p) => {
    maxLength(p.title, MAX_LIST_TITLE, { message: MESSAGE.tooLong(MAX_LIST_TITLE) });
    maxLength(p.subtitle, MAX_LIST_SUBTITLE, { message: MESSAGE.tooLong(MAX_LIST_SUBTITLE) });
    applyEach(p.signers, (s) => {
      required(s.position, { message: 'Вкажіть посаду' });
      required(s.name, { message: 'Вкажіть ім’я та прізвище' });
      maxLength(s.position, 200, { message: MESSAGE.tooLong(200) });
      maxLength(s.name, 200, { message: MESSAGE.tooLong(200) });
    });
  });
  protected readonly dirty = computed(
    () => JSON.stringify(this.model()) !== JSON.stringify(sectionBody(this.current())),
  );

  protected readonly chosen = computed(() => new Set(this.model().columns));
  protected readonly columnItems = computed(() => columnItems(this.model().columns));
  protected readonly busy = signal(false);

  protected async selectSection(section: ListSection) {
    if (section === this.section()) return;
    if (this.dirty()) {
      const choice = await this.dialogs.unsaved({
        text: 'Ви змінили налаштування цього списку. Якщо перейти до іншого без збереження, зміни пропадуть.',
      });
      if (choice === 'stay') return;
      if (choice === 'save' && !(await this.saveSection())) return;
    }
    this.section.set(section);
  }

  private set<K extends keyof ListSectionSettingsBody>(key: K, value: ListSectionSettingsBody[K]) {
    this.model.update((m) => ({ ...m, [key]: value }));
  }

  protected toggle(key: ListColumnKey, event: Event) {
    const on = (event.target as HTMLInputElement).checked;
    this.set('columns', toggleColumn(this.model().columns, key, on));
  }

  protected reorder(order: string[]) {
    this.set('columns', withNumberFirst(order));
  }

  protected allColumns() {
    this.set(
      'columns',
      LIST_COLUMN_OPTIONS.map((o) => o.value),
    );
  }

  protected setSort(value: string) {
    this.set('sort', value as ListSort);
  }

  protected setGrouping(value: string) {
    this.set('groupBy', value as ListGrouping);
  }

  protected setShowOutgoing(event: Event) {
    this.set('showOutgoing', (event.target as HTMLInputElement).checked);
  }

  protected addSigner() {
    if (this.model().signers.length >= MAX_LIST_SIGNERS) return;
    this.set('signers', [...this.model().signers, { position: '', name: '' }]);
  }

  protected removeSigner(index: number) {
    this.set(
      'signers',
      this.model().signers.filter((_, i) => i !== index),
    );
  }

  protected reset() {
    this.model.set(sectionBody(this.current()));
  }

  protected async save(event: Event) {
    event.preventDefault();
    await this.saveSection();
  }

  /** Saves the list on the screen; false — not saved (the errors are on the fields or in a snackbar). */
  private async saveSection(): Promise<boolean> {
    let saved = false;
    await submit(this.settingsForm, async () => {
      try {
        this.settings.set(
          await this.service.save(this.data().entityId, this.section(), this.model()),
        );
        this.toast.success('Вигляд списку збережено');
        saved = true;
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.settingsForm, this.notifyError);
      }
    });
    return saved;
  }

  protected exampleUrl() {
    return this.service.exampleUrl(this.data().entityId, this.section());
  }

  protected templateUrl() {
    return this.service.templateUrl(this.data().entityId, this.section());
  }

  protected async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) {
      this.toast.error('Потрібен файл Word у форматі .docx');
      return;
    }
    if (file.size > MAX_TEMPLATE_BYTES) {
      this.toast.error('Файл завеликий — не більше 2 МБ');
      return;
    }
    this.busy.set(true);
    try {
      const unsaved = this.dirty() ? this.model() : null;
      this.settings.set(
        await this.service.uploadTemplate(this.data().entityId, this.section(), file),
      );
      // the screen keeps the edits that were not saved yet
      if (unsaved) this.model.set(unsaved);
      this.toast.success('Шаблон завантажено й перевірено — документи цього списку будуть за ним');
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async removeTemplate() {
    const ok = await this.dialogs.confirm({
      title: 'Прибрати власний шаблон?',
      text: 'Документ цього списку знову буде у вбудованому вигляді.',
      confirmLabel: 'Прибрати шаблон',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      const unsaved = this.dirty() ? this.model() : null;
      this.settings.set(await this.service.removeTemplate(this.data().entityId, this.section()));
      if (unsaved) this.model.set(unsaved);
      this.toast.success('Шаблон прибрано');
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}

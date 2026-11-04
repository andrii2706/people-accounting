import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type { Tck } from '../../../shared/interfaces/dictionary.interface';
import type { PendingTckImport, TckForm } from '../../../shared/interfaces/organization.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { EMPTY_TCK_FORM, MAX_TCK_IMPORT_BYTES } from '../../../shared/constants/tck.constants';
import { parseTckImport, tckToForm } from '../../../shared/utils/tck.utils';
import { MESSAGE, PATTERN } from '../../../shared/validators/employee-rules';

/** Directory of TCKs: addresses and e-mails for letters, notices and extracts. */
@Component({
  selector: 'app-tck-directory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, FormField, FormFieldComponent, IconComponent],
  templateUrl: './tck-directory.component.html',
})
export class TckDirectoryComponent {
  protected readonly auth = inject(AuthService);
  protected readonly dict = inject(DictionariesService);
  private readonly toast = inject(ToastService);
  private readonly notifyError = (message: string) => this.toast.error(message);

  // TCK import file is produced by `npm run tck:export`
  protected readonly tckImport = signal<PendingTckImport | null>(null);
  protected readonly importingTck = signal(false);

  protected async pickTckFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_TCK_IMPORT_BYTES) throw new Error('Файл завеликий (понад 2 МБ)');
      this.tckImport.set({ file: file.name, items: parseTckImport(await file.text()) });
    } catch (err) {
      this.toast.error(
        err instanceof SyntaxError ? 'Це не JSON-файл експорту ТЦК' : (err as Error).message,
      );
    }
  }

  protected async confirmTckImport() {
    const pending = this.tckImport();
    if (!pending) return;
    this.importingTck.set(true);
    try {
      const r = await this.dict.importTck(pending.items);
      this.tckImport.set(null);
      await this.dict.reloadTcks();
      this.toast.success(`Імпортовано: нових ${r.created}, оновлено ${r.updated}`);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.importingTck.set(false);
    }
  }

  protected readonly tckFilter = signal('');
  protected readonly tcks = computed(() => {
    const q = this.tckFilter().toLowerCase();
    return this.dict.tcks().filter((t) => !q || t.name.toLowerCase().includes(q));
  });
  protected readonly editingTck = signal<string | null>(null);
  protected readonly tckModel = signal<TckForm>({ ...EMPTY_TCK_FORM });
  protected readonly tckForm = form(this.tckModel, (p) => {
    required(p.name, { message: 'Вкажіть назву' });
    maxLength(p.name, 300, { message: MESSAGE.tooLong(300) });
    maxLength(p.nameGenitive, 300, { message: MESSAGE.tooLong(300) });
    maxLength(p.address, 300, { message: MESSAGE.tooLong(300) });
    pattern(p.postalCode, PATTERN.postalCode, { message: MESSAGE.postalCode });
    maxLength(p.phone, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.email, 200, { message: MESSAGE.tooLong(200) });
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
  });

  protected editTck(t: Tck | null) {
    this.editingTck.set(t?.id ?? 'new');
    this.tckModel.set(tckToForm(t));
    this.tckForm().reset();
  }

  protected async saveTck(event: Event) {
    event.preventDefault();
    await submit(this.tckForm, async () => {
      try {
        const id = this.editingTck();
        await this.dict.saveTck(this.tckModel(), id && id !== 'new' ? id : undefined);
        this.editingTck.set(null);
        await this.dict.reloadTcks();
        this.toast.success('ТЦК збережено');
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.tckForm, this.notifyError);
      }
    });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import type { Tck, TckFilter } from '../../../shared/interfaces/dictionary.interface';
import type { PendingTckImport, TckForm } from '../../../shared/interfaces/organization.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import {
  EMPTY_TCK_FILTER,
  EMPTY_TCK_FORM,
  MAX_TCK_IMPORT_BYTES,
  TCK_PLACE_MAX,
} from '../../../shared/constants/tck.constants';
import {
  parseTckImport,
  tckMatches,
  tckPlaceOptions,
  tckPlaceDetails,
  tckToForm,
} from '../../../shared/utils/tck.utils';
import { MESSAGE, PATTERN } from '../../../shared/validators/employee-rules';
import { UiBusyDirective } from '@mr/ui';
import { TckMatchesComponent } from '../../../shared/components/tck-matches/tck-matches.component';

/** Directory of TCKs: addresses and e-mails for letters, notices and extracts; filters by region, town, district. */
@Component({
  selector: 'app-tck-directory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiBusyDirective,
    PageHeaderComponent,
    FormField,
    FormFieldComponent,
    IconComponent,
    SelectComponent,
    TckMatchesComponent,
  ],
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

  /** Region → town → district: each list shows only what is left after the filters above it. */
  protected readonly filter = signal<TckFilter>({ ...EMPTY_TCK_FILTER });
  protected readonly tcks = computed(() =>
    this.dict.tcks().filter((t) => tckMatches(t, this.filter())),
  );
  protected readonly regionOptions = computed(() => tckPlaceOptions(this.dict.tcks(), 'region'));
  protected readonly cityOptions = computed(() => {
    const { region } = this.filter();
    return tckPlaceOptions(this.inScope({ region }), 'city');
  });
  protected readonly districtOptions = computed(() => {
    const { region, city } = this.filter();
    return tckPlaceOptions(this.inScope({ region, city }), 'district');
  });
  protected readonly filtered = computed(() => {
    const f = this.filter();
    return !!(f.query || f.region || f.city || f.district);
  });
  protected readonly placeDetails = tckPlaceDetails;

  private inScope(f: Partial<TckFilter>) {
    return this.dict.tcks().filter((t) => tckMatches(t, { ...EMPTY_TCK_FILTER, ...f }));
  }

  protected setQuery(query: string) {
    this.filter.update((f) => ({ ...f, query }));
  }

  /** A new region clears the town and the district that are not in it; a new town — the district. */
  protected setRegion(region: string) {
    this.filter.update((f) => ({ ...f, region, city: '', district: '' }));
  }
  protected setCity(city: string) {
    this.filter.update((f) => {
      const next = { ...f, city };
      // the town decides the region when none is chosen («м. Броди» → «Львівська область»)
      if (city && !f.region)
        next.region = this.dict.tcks().find((t) => t.city === city)?.region ?? '';
      if (f.district && !this.inScope({ region: next.region, city, district: f.district }).length)
        next.district = '';
      return next;
    });
  }
  protected setDistrict(district: string) {
    this.filter.update((f) => ({ ...f, district }));
  }
  protected resetFilter() {
    this.filter.set({ ...EMPTY_TCK_FILTER });
  }
  protected readonly editingTck = signal<string | null>(null);
  /** The TCK just added — for «Підтягнути в картки?». */
  protected readonly addedTck = signal<string | null>(null);
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
    maxLength(p.region, TCK_PLACE_MAX, { message: MESSAGE.tooLong(TCK_PLACE_MAX) });
    maxLength(p.district, TCK_PLACE_MAX, { message: MESSAGE.tooLong(TCK_PLACE_MAX) });
    maxLength(p.city, TCK_PLACE_MAX, { message: MESSAGE.tooLong(TCK_PLACE_MAX) });
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
        const saved = await this.dict.saveTck(this.tckModel(), id && id !== 'new' ? id : undefined);
        this.editingTck.set(null);
        // a new TCK: the cards whose document was issued by it are offered to get it
        this.addedTck.set(id === 'new' ? saved.id : null);
        await this.dict.reloadTcks();
        this.toast.success('ТЦК збережено');
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.tckForm, this.notifyError);
      }
    });
  }
}

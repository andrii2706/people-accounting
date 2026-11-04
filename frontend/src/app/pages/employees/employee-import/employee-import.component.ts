import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { isElectronicDocType } from '../../../shared/validators/employee-rules';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type {
  CheckedImportRow,
  ImportCommitErrorBody,
  ImportPreview,
  ImportValues,
  ImportRowFilter,
  HireNoticesMode,
} from '../../../shared/interfaces/employee-import.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { LegalEntityFilterComponent } from '../../../shared/components/legal-entity-filter/legal-entity-filter.component';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { EmployeeImportService } from '../../../shared/services/employee-import.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';
import { addDaysIso, todayIso } from '../../../shared/utils/date.utils';
import {
  IMPORT_ALWAYS_SHOWN,
  IMPORT_EDIT_FIELDS,
  IMPORT_RECENT_NOTICE_DAYS,
} from '../../../shared/constants/employee-import.constants';
import { importRowStatus } from '../../../shared/utils/employee-import.utils';

/**
 * Import of many employees from a file (.xlsx / .csv, e.g. a 1C report).
 * 1) upload → the server reads and checks every row (nothing is saved);
 * 2) the user reviews, fixes rows and checks again;
 * 3) only the selected rows without errors are created — all at once.
 */
@Component({
  selector: 'app-employee-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    IconComponent,
    RouterLink,
    UaDatePipe,
    DateInputComponent,
    LegalEntityFilterComponent,
  ],
  templateUrl: './employee-import.component.html',
})
export class EmployeeImportComponent {
  private readonly importer = inject(EmployeeImportService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly dictionaries = inject(DictionariesService);

  protected readonly templateUrl = this.importer.templateUrl;
  protected readonly busy = signal(false);
  protected readonly dragOver = signal(false);
  protected readonly preview = signal<ImportPreview | null>(null);
  protected readonly rows = linkedSignal(() => this.preview()?.rows ?? []);
  /** Rows changed after the last check — they must be checked again before the import. */
  protected readonly dirty = signal(false);
  protected readonly expanded = signal<number | null>(null);
  protected readonly filter = signal<ImportRowFilter>('all');
  /** TCK notices about hiring: only the recently hired by default (people hired long ago were reported). */
  protected readonly hireNotices = signal<HireNoticesMode>('RECENT');
  /** The legal entity of all imported employees; with several it must be chosen. */
  protected readonly legalEntityId = signal('');
  protected readonly recentDays = IMPORT_RECENT_NOTICE_DAYS;
  private readonly recentSince = addDaysIso(todayIso(), -IMPORT_RECENT_NOTICE_DAYS);
  /** How many of the selected rows will get a notice in each mode. */
  protected readonly noticeCounts = computed(() => {
    const rows = this.rows().filter(
      (r) => importRowStatus(r) === 'ready' && this.selected().has(r.rowNumber),
    );
    const dated = rows.filter((r) => r.values['hireDate']);
    return {
      ALL: dated.length,
      RECENT: dated.filter((r) => String(r.values['hireDate']) >= this.recentSince).length,
    };
  });
  /** Selected rows (by row number); by default — every row that is ready. */
  protected readonly selected = linkedSignal<CheckedImportRow[], Set<number>>({
    source: this.rows,
    computation: (rows, previous) => {
      const ready = rows.filter((r) => importRowStatus(r) === 'ready').map((r) => r.rowNumber);
      if (!previous) return new Set(ready);
      // keep the user's choice; rows that just became ready are selected
      const before = new Set(
        previous.source.filter((r) => importRowStatus(r) === 'ready').map((r) => r.rowNumber),
      );
      return new Set(ready.filter((n) => previous.value.has(n) || !before.has(n)));
    },
  });

  protected readonly status = importRowStatus;
  protected readonly counts = computed(() => {
    const c = { all: 0, ready: 0, error: 0, duplicate: 0 };
    for (const r of this.rows()) {
      c.all++;
      c[importRowStatus(r)]++;
    }
    return c;
  });
  protected readonly visibleRows = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.rows() : this.rows().filter((r) => importRowStatus(r) === f);
  });
  protected readonly selectedCount = computed(
    () =>
      this.rows().filter((r) => importRowStatus(r) === 'ready' && this.selected().has(r.rowNumber))
        .length,
  );
  protected readonly recognized = computed(() =>
    (this.preview()?.mapping ?? []).filter((m) => m.field),
  );
  protected readonly ignored = computed(() =>
    (this.preview()?.mapping ?? []).filter((m) => !m.field),
  );

  protected onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.upload(file);
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.upload(file);
  }

  protected onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(true);
  }

  private async upload(file: File) {
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      this.toast.error('Підтримуються файли .xlsx і .csv. Файл .xls збережіть в Excel як .xlsx.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error('Файл завеликий — не більше 5 МБ');
      return;
    }
    this.busy.set(true);
    try {
      this.preview.set(await this.importer.preview(file));
      this.dirty.set(false);
      this.expanded.set(null);
      this.filter.set(this.counts().error ? 'error' : 'all');
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected reset() {
    this.preview.set(null);
    this.dirty.set(false);
  }

  protected toggle(row: CheckedImportRow, checked: boolean) {
    this.selected.update((s) => {
      const next = new Set(s);
      if (checked) next.add(row.rowNumber);
      else next.delete(row.rowNumber);
      return next;
    });
  }

  protected toggleAll(checked: boolean) {
    this.selected.set(
      new Set(
        checked
          ? this.rows()
              .filter((r) => importRowStatus(r) === 'ready')
              .map((r) => r.rowNumber)
          : [],
      ),
    );
  }

  protected toggleExpanded(row: CheckedImportRow) {
    this.expanded.update((n) => (n === row.rowNumber ? null : row.rowNumber));
  }

  /** Fields shown in the editor of a row. */
  protected fieldsOf(row: CheckedImportRow) {
    const withError = new Set(row.errors.map((e) => e.field));
    return IMPORT_EDIT_FIELDS.filter(
      (f) => IMPORT_ALWAYS_SHOWN.has(f.key) || f.key in row.values || withError.has(f.key),
    );
  }

  protected errorsOf(row: CheckedImportRow, field: string) {
    return row.errors.filter((e) => e.field === field).map((e) => e.message);
  }

  protected text(row: CheckedImportRow, key: string): string {
    const v = row.values[key];
    return v === null || v === undefined ? '' : String(v);
  }

  /** Edits one value; the problems of this field are cleared until the next check. */
  protected setValue(row: CheckedImportRow, key: string, raw: string | boolean) {
    let value: ImportValues[string] | undefined = raw;
    if (raw === '') value = undefined;
    else if (key === 'rankCode') value = Number(raw);
    else if (typeof raw === 'string') value = raw.trim();
    this.rows.update((rows) =>
      rows.map((r) => {
        if (r.rowNumber !== row.rowNumber) return r;
        const values = { ...r.values };
        if (value === undefined) delete values[key];
        else values[key] = value;
        // electronic document (єВОД) has no series or number
        if (key === 'militaryDocType' && isElectronicDocType(String(value ?? ''))) {
          delete values['militaryDocNumber'];
          delete values['militaryDocSeries'];
        }
        // men are on military registration by default
        if (key === 'gender' && value === 'M' && values['militaryRegistered'] === undefined) {
          values['militaryRegistered'] = true;
        }
        return {
          ...r,
          values,
          issues: r.issues.filter((i) => i.field !== key),
          errors: r.errors.filter((e) => e.field !== key),
          fullName: [values['lastName'], values['firstName'], values['middleName']]
            .filter(Boolean)
            .join(' '),
        };
      }),
    );
    this.dirty.set(true);
  }

  /** Series and number of an electronic document (єВОД) are not filled in. */
  protected isLockedByDocType(row: CheckedImportRow, key: string) {
    return (
      (key === 'militaryDocNumber' || key === 'militaryDocSeries') &&
      isElectronicDocType(String(row.values['militaryDocType'] ?? ''))
    );
  }

  protected rankLabel(code: unknown, navy: unknown) {
    const rank = typeof code === 'number' ? this.dictionaries.rank(code) : undefined;
    return rank ? (navy ? rank.navy : rank.army) : '';
  }

  protected tckLabel(id: unknown) {
    return this.dictionaries.tcks().find((t) => t.id === id)?.name ?? '';
  }

  protected async recheck() {
    this.busy.set(true);
    try {
      this.rows.set(await this.importer.check(this.rows()));
      this.dirty.set(false);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async commit() {
    const rows = this.rows().filter(
      (r) => importRowStatus(r) === 'ready' && this.selected().has(r.rowNumber),
    );
    if (!rows.length || this.dirty()) return;
    this.busy.set(true);
    try {
      const result = await this.importer.commit(rows, {
        hireNotices: this.hireNotices(),
        fileName: this.preview()?.fileName,
        legalEntityId: this.legalEntityId(),
      });
      this.toast.success(
        `Імпортовано працівників: ${result.created}` +
          (result.notices ? `, створено повідомлень ТЦК: ${result.notices}` : ''),
      );
      await this.router.navigate(['/employees']);
    } catch (err) {
      // the server re-checks everything; on a conflict it returns the checked rows
      const body = err instanceof HttpErrorResponse ? (err.error as ImportCommitErrorBody) : null;
      if (body?.rows) {
        const fresh = new Map(body.rows.map((r) => [r.rowNumber, r]));
        this.rows.update((all) => all.map((r) => fresh.get(r.rowNumber) ?? r));
      }
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}

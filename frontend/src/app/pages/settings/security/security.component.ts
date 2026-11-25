import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import type { SelectOption } from '../../../shared/interfaces/ui.interface';
import {
  SECURITY_KIND_GROUPS,
  SECURITY_KIND_TEXT,
  SECURITY_LEVEL_CLASS,
  SECURITY_LEVEL_TEXT,
  SECURITY_PAGE_SIZE,
} from '../../../shared/constants/security.constants';
import type {
  ExportTrace,
  SecurityEventKind,
  SecurityEventsPage,
} from '../../../shared/interfaces/security.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { SecurityService } from '../../../shared/services/security.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { securityDetails, sha256Hex } from '../../../shared/utils/security.utils';
import { UiSkeletonListComponent } from '@mr/ui';

/**
 * Settings → «Безпека»: what looked like a break-in or a leak (with the letters that went out about it),
 * and «who downloaded this file» by the file itself.
 */
@Component({
  selector: 'app-security',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiSkeletonListComponent,
    PageHeaderComponent,
    IconComponent,
    SelectComponent,
    UaDateTimePipe,
  ],
  templateUrl: './security.component.html',
})
export class SecurityComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(SecurityService);

  /** «Вхід · Вхід з нового пристрою» — the kinds with their group in the hint. */
  protected readonly kindOptions: SelectOption[] = SECURITY_KIND_GROUPS.flatMap((g) =>
    g.kinds.map((k) => ({ value: k, label: SECURITY_KIND_TEXT[k], hint: g.label })),
  );
  protected readonly kindText = SECURITY_KIND_TEXT;
  protected readonly levelText = SECURITY_LEVEL_TEXT;
  protected readonly levelClass = SECURITY_LEVEL_CLASS;
  protected readonly details = securityDetails;

  protected readonly kind = signal<SecurityEventKind | ''>('');
  protected readonly page = signal(1);
  protected readonly data = signal<SecurityEventsPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil((this.data()?.total ?? 0) / SECURITY_PAGE_SIZE)),
  );

  protected readonly traceFile = signal('');
  protected readonly traces = signal<ExportTrace[] | null>(null);
  protected readonly tracing = signal(false);
  protected readonly traceError = signal('');

  constructor() {
    void this.load();
  }

  protected async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.data.set(
        await this.api.events({
          kind: this.kind() || undefined,
          page: this.page(),
          size: SECURITY_PAGE_SIZE,
        }),
      );
    } catch (err) {
      this.error.set(apiErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected filter(kind: string) {
    this.kind.set(kind as SecurityEventKind | '');
    this.page.set(1);
    void this.load();
  }

  protected go(page: number) {
    this.page.set(page);
    void this.load();
  }

  protected async trace(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.traceFile.set(file.name);
    this.traces.set(null);
    this.traceError.set('');
    this.tracing.set(true);
    try {
      this.traces.set(await this.api.trace(await sha256Hex(file)));
    } catch (err) {
      this.traceError.set(apiErrorMessage(err));
    } finally {
      this.tracing.set(false);
    }
  }
}

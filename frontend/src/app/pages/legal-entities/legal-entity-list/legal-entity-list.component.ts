import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type { LegalEntitySummary } from '../../../shared/interfaces/legal-entity.interface';
import { AuthService } from '../../../shared/services/auth.service';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import {
  legalEntityName,
  percentText,
  youControlUrl,
} from '../../../shared/utils/legal-entity.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';

/** Legal entities of the client: who is the head and who keeps the military registration. */
@Component({
  selector: 'app-legal-entity-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UaDatePipe, PageHeaderComponent, IconComponent, RouterLink],
  templateUrl: './legal-entity-list.component.html',
})
export class LegalEntityListComponent {
  protected readonly auth = inject(AuthService);
  private readonly service = inject(LegalEntitiesService);
  private readonly dict = inject(DictionariesService);
  private readonly toast = inject(ToastService);
  private readonly refresh = injectRouteRefresh();

  /** legalEntitiesResolver */
  readonly entities = input.required<LegalEntitySummary[]>();

  protected readonly name = legalEntityName;
  protected readonly youControlUrl = youControlUrl;
  protected readonly percent = percentText;

  protected async remove(e: LegalEntitySummary) {
    try {
      await this.service.remove(e.id);
      this.toast.success(`«${legalEntityName(e)}» видалено`);
      await this.dict.reloadLegalEntities();
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }
}

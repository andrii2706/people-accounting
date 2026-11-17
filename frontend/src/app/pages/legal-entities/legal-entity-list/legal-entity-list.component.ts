import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { ActionsMenuComponent } from '../../../shared/components/actions-menu/actions-menu.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { MenuAction } from '../../../shared/interfaces/ui.interface';
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
  imports: [UaDatePipe, PageHeaderComponent, IconComponent, RouterLink, ActionsMenuComponent],
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

  /** The «⋯» menu of a row: the settings pages of the legal entity and (the main administrator) deleting it. */
  protected entityActions(e: LegalEntitySummary): MenuAction[] {
    const actions: MenuAction[] = [];
    if (this.auth.isEntityManager())
      actions.push(
        { label: 'Редагувати', icon: 'edit', link: ['/settings/legal-entities', e.id] },
        {
          label: 'Наклейки на конверти',
          icon: 'mail',
          hint: 'Шрифт, розміри, A4 чи конверт',
          link: ['/settings/legal-entities', e.id, 'labels'],
        },
        {
          label: 'Власна база даних',
          icon: 'database',
          hint: 'Підключення до сервера вашої компанії',
          link: ['/settings/legal-entities', e.id, 'database'],
        },
      );
    if (this.auth.isAdmin())
      actions.push({
        label: 'Видалити юрособу',
        icon: 'trash',
        danger: true,
        disabled: e.allEmployees > 0,
        hint:
          e.allEmployees > 0
            ? 'Спершу переведіть працівників (разом зі звільненими) в іншу юрособу'
            : undefined,
        run: () => this.remove(e),
      });
    return actions;
  }

  protected async remove(e: LegalEntitySummary) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Видалити юрособу «${legalEntityName(e)}»? Цю дію не можна скасувати.`)
    )
      return;
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

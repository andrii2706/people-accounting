import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type { PendingChange } from '../../../shared/interfaces/employee.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { LettersService } from '../../../shared/services/letters.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';

interface EmployeeGroup {
  employeeId: string;
  fullName: string;
  tckId: string | null;
  tckName: string;
  tckEmail: string;
  overdue: boolean;
  changes: PendingChange[];
}

@Component({
  selector: 'app-pending-changes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, RouterLink, IconComponent, UaDatePipe],
  templateUrl: './pending-changes.component.html',
})
export class PendingChangesComponent {
  private readonly lettersService = inject(LettersService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Дані з pendingChangesResolver. */
  readonly pending = input.required<PendingChange[]>();
  protected readonly busy = signal<string | null>(null);

  /** Групування по працівниках; прострочені — першими. */
  protected readonly groups = computed<EmployeeGroup[]>(() => {
    const map = new Map<string, EmployeeGroup>();
    for (const c of this.pending()) {
      const g = map.get(c.employee.id) ?? {
        employeeId: c.employee.id,
        fullName: c.employee.fullName,
        tckId: c.employee.tckId,
        tckName: c.employee.tckName,
        tckEmail: c.employee.tckEmail,
        overdue: false,
        changes: [],
      };
      g.changes.push(c);
      g.overdue ||= c.overdue;
      map.set(c.employee.id, g);
    }
    return [...map.values()].sort(
      (a, b) => Number(b.overdue) - Number(a.overdue) || a.fullName.localeCompare(b.fullName, 'uk'),
    );
  });

  protected async createLetter(g: EmployeeGroup) {
    this.busy.set(g.employeeId);
    try {
      const letter = await this.lettersService.createChangeNotice(g.employeeId);
      this.toast.success(`Лист вих. № ${letter.number} сформовано`);
      await this.router.navigate(['/letters', letter.id]);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(null);
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { UiBusyDirective } from '@mr/ui';
import type { TckMatch } from '../../interfaces/employee.interface';
import { EmployeesService } from '../../services/employees.service';
import { ToastService } from '../../services/toast.service';
import { apiErrorMessage } from '../../utils/api-error.utils';

/**
 * After a TCK is added to the directory: the cards without a TCK whose military document was issued by it —
 * offered to fill in all at once (each goes through the card's history and journal).
 */
@Component({
  selector: 'app-tck-matches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiBusyDirective],
  template: `
    @if (matches().length) {
      <section
        class="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm"
        aria-live="polite"
      >
        <p>
          <b class="font-semibold">Підтягнути в картки?</b>
          У {{ matches().length }} працівн. «Ким виданий» документа — цей ТЦК, а ТЦК у картці не
          вказано:
        </p>
        <ul class="mt-2 space-y-1.5">
          @for (m of matches(); track m.id) {
            <li>
              <label class="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  class="mt-0.5 size-4 cursor-pointer accent-brand-600"
                  [checked]="chosen().has(m.id)"
                  (change)="toggle(m.id)"
                />
                <span
                  >{{ m.fullName }}
                  <span class="block text-xs text-muted">{{ m.issuedBy }}</span></span
                >
              </label>
            </li>
          }
        </ul>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-primary btn-sm cursor-pointer"
            [uiBusy]="busy()"
            [disabled]="busy() || !chosen().size"
            (click)="assign()"
          >
            Підставити ({{ chosen().size }})
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm cursor-pointer"
            (click)="matches.set([])"
          >
            Не зараз
          </button>
        </div>
      </section>
    }
  `,
})
export class TckMatchesComponent {
  private readonly employees = inject(EmployeesService);
  private readonly toast = inject(ToastService);

  /** The TCK just added to the directory. */
  readonly tckId = input<string | null>(null);
  readonly assigned = output<number>();

  protected readonly matches = signal<TckMatch[]>([]);
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly busy = signal(false);
  protected readonly empty = computed(() => !this.matches().length);

  constructor() {
    effect(async () => {
      const id = this.tckId();
      this.matches.set([]);
      if (!id) return;
      try {
        const list = await this.employees.tckMatches(id);
        this.matches.set(list);
        this.chosen.set(new Set(list.map((m) => m.id)));
      } catch {
        this.matches.set([]);
      }
    });
  }

  protected toggle(id: string) {
    this.chosen.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected async assign() {
    const id = this.tckId();
    if (!id) return;
    this.busy.set(true);
    try {
      const { assigned } = await this.employees.assignTck(id, [...this.chosen()]);
      this.toast.success(`ТЦК підставлено в ${assigned} картк.`);
      this.matches.set([]);
      this.assigned.emit(assigned);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}

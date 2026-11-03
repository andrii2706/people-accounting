import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon/icon.component';
import type { EmployeeListItem } from '../../shared/interfaces/employee.interface';
import type { IconName, PaletteEntry } from '../../shared/interfaces/ui.interface';
import { EmployeesService } from '../../shared/services/employees.service';

/** Global search (Ctrl K): employees by name, РНОКПП, personnel number, plus quick actions. */
@Component({
  selector: 'app-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './command-palette.component.html',
})
export class CommandPaletteComponent {
  private readonly employees = inject(EmployeesService);
  private readonly router = inject(Router);
  readonly closed = output<void>();

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  protected readonly query = signal('');
  protected readonly found = signal<EmployeeListItem[]>([]);
  protected readonly searching = signal(false);
  protected readonly active = signal(0);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;

  private readonly actions: PaletteEntry[] = [
    {
      id: 'a-new',
      icon: 'plus',
      title: 'Додати працівника',
      hint: 'Нова картка',
      go: () => this.open(['/employees/new']),
    },
    {
      id: 'a-import',
      icon: 'upload',
      title: 'Імпорт з файлу',
      hint: 'Excel / CSV',
      go: () => this.open(['/employees/import']),
    },
    {
      id: 'a-notices',
      icon: 'send',
      title: 'Повідомлення ТЦК',
      hint: 'Сформувати лист',
      go: () => this.open(['/notifications']),
    },
    {
      id: 'a-lists',
      icon: 'table',
      title: 'Списки (Дод. 5)',
      hint: 'Звітність',
      go: () => this.open(['/reports/lists']),
    },
    {
      id: 'a-operational',
      icon: 'file',
      title: 'Відомість (Дод. 12)',
      hint: 'Звітність',
      go: () => this.open(['/reports/operational']),
    },
  ];

  protected readonly entries = computed<PaletteEntry[]>(() => {
    const q = this.query().trim().toLowerCase();
    const people = this.found().map((e) => ({
      id: e.id,
      icon: 'users' as IconName,
      title: e.fullName,
      hint: [
        e.personnelNumber && `таб. ${e.personnelNumber}`,
        e.position,
        e.dismissalDate && 'звільнений',
      ]
        .filter(Boolean)
        .join(' · '),
      go: () => this.open(['/employees', e.id]),
    }));
    const actions = q
      ? this.actions.filter((a) => a.title.toLowerCase().includes(q))
      : this.actions;
    return [...people, ...actions];
  });
  protected readonly peopleCount = computed(() => this.found().length);

  constructor() {
    afterNextRender(() => this.input().nativeElement.focus());
  }

  protected onInput(value: string) {
    this.query.set(value);
    this.active.set(0);
    if (this.timer) clearTimeout(this.timer);
    const q = value.trim();
    if (q.length < 2) {
      this.found.set([]);
      return;
    }
    this.timer = setTimeout(() => void this.search(q), 200);
  }

  private async search(q: string) {
    const id = ++this.requestId;
    this.searching.set(true);
    try {
      const list = await firstValueFrom(this.employees.list({ search: q, status: 'all' }));
      if (id === this.requestId) this.found.set(list.items.slice(0, 8));
    } catch {
      if (id === this.requestId) this.found.set([]);
    } finally {
      if (id === this.requestId) this.searching.set(false);
    }
  }

  protected onKeydown(event: KeyboardEvent) {
    const count = this.entries().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.active.update((i) => (count ? (i + 1) % count : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.update((i) => (count ? (i - 1 + count) % count : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.entries()[this.active()]?.go();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
    }
  }

  protected pick(entry: PaletteEntry) {
    entry.go();
  }

  private open(commands: string[]) {
    this.closed.emit();
    void this.router.navigate(commands);
  }
}

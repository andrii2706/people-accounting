import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { IconComponent, type IconName } from '../../shared/components/icon/icon.component';
import { AuthService } from '../../shared/services/auth.service';
import { EmployeesService } from '../../shared/services/employees.service';
import { NavigationStateService } from '../../shared/services/navigation-state.service';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);
  /** Індикатор, поки резолвери вантажать дані наступної сторінки. */
  protected readonly isNavigating = inject(NavigationStateService).isNavigating;

  private readonly navigationTick = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => {
        this.menuOpen.set(false);
        return (e as NavigationEnd).id;
      }),
    ),
    { initialValue: 0 },
  );

  // перезапит лічильника після кожної навігації; до зміни тимчасового пароля — не запитуємо
  private readonly pending = inject(EmployeesService).pendingChangesResource(() =>
    this.auth.mustChangePassword() ? undefined : this.navigationTick(),
  );
  protected readonly pendingCount = computed(() =>
    this.pending.hasValue() ? this.pending.value().length : 0,
  );

  private readonly items: NavItem[] = [
    { path: '/', label: 'Огляд', icon: 'dashboard', exact: true },
    { path: '/employees', label: 'Працівники', icon: 'users' },
    { path: '/notifications', label: 'Повідомлення ТЦК', icon: 'bell' },
    { path: '/letters', label: 'Вихідні листи', icon: 'mail' },
    { path: '/reports/lists', label: 'Списки (Дод. 13)', icon: 'table' },
    { path: '/reports/operational', label: 'Відомість (Дод. 12)', icon: 'file' },
    { path: '/settings', label: 'Налаштування', icon: 'settings' },
  ];
  protected readonly nav = computed(() =>
    this.items.filter((i) => !i.adminOnly || this.auth.isAdmin()),
  );
}

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AuthService } from '../../shared/services/auth.service';
import { EmployeesService } from '../../shared/services/employees.service';
import { IdleTimeoutService } from '../../shared/services/idle-timeout.service';
import { InboxService } from '../../shared/services/inbox.service';
import { InboxListComponent } from '../../shared/components/inbox-list/inbox-list.component';
import type { InboxItem } from '../../shared/interfaces/inbox.interface';
import { NavigationStateService } from '../../shared/services/navigation-state.service';
import type { IconName, NavItem } from '../../shared/interfaces/ui.interface';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, InboxListComponent],
  host: { '(document:keydown.escape)': 'closeInbox()' },
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);
  /** Indicator shown while resolvers load data of the next page. */
  protected readonly isNavigating = inject(NavigationStateService).isNavigating;
  /** Sign-out after 10 minutes without mouse / keyboard activity (only in the browser). */
  protected readonly idle = inject(IdleTimeoutService);

  /** In-app notifications: the bell (panel) and the window with the new ones after a sign-in. */
  protected readonly inbox = inject(InboxService);
  private readonly router = inject(Router);
  protected readonly inboxOpen = signal(false);
  protected readonly welcomeOpen = signal(false);
  protected readonly welcomeItems = computed(() => this.inbox.unread().slice(0, 6));
  protected readonly unreadByKind = computed(() => {
    const unread = this.inbox.unread();
    return {
      DEADLINE: unread.filter((i) => i.kind === 'DEADLINE').length,
      TCK: unread.filter((i) => i.kind === 'TCK').length,
      CARD: unread.filter((i) => i.kind === 'CARD').length,
    };
  });

  constructor() {
    afterNextRender(() => this.idle.start());
    inject(DestroyRef).onDestroy(() => {
      this.idle.stop();
      this.inbox.reset();
    });
    // refresh after every navigation — the data could have changed (a card saved, a letter sent)
    effect(() => {
      this.navigationTick();
      if (this.auth.isAuthenticated() && !this.auth.mustChangePassword()) void this.inbox.load();
    });
    // right after a sign-in: show the new notifications once
    effect(() => {
      if (!this.auth.justSignedIn() || !this.inbox.loaded()) return;
      this.auth.justSignedIn.set(false);
      if (this.inbox.unreadCount() > 0 && !this.auth.mustChangePassword())
        this.welcomeOpen.set(true);
    });
  }

  protected toggleInbox() {
    this.inboxOpen.update((v) => !v);
  }

  protected closeInbox() {
    this.inboxOpen.set(false);
    this.welcomeOpen.set(false);
  }

  protected showAll() {
    this.welcomeOpen.set(false);
    this.inboxOpen.set(true);
  }

  protected async openItem(item: InboxItem) {
    this.closeInbox();
    void this.inbox.markRead([item.key]);
    await this.router.navigate(
      item.link === 'NOTICES' ? ['/notifications'] : ['/employees', item.employeeId],
    );
  }

  protected markRead(item: InboxItem) {
    void this.inbox.markRead([item.key]);
  }

  protected async markAllRead() {
    await this.inbox.markAllRead();
    this.welcomeOpen.set(false);
  }

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

  // re-request the counter after every navigation; not requested before the temporary password is changed
  private readonly pending = inject(EmployeesService).pendingChangesResource(() =>
    this.auth.mustChangePassword() ? undefined : this.navigationTick(),
  );
  protected readonly pendingCount = computed(() =>
    this.pending.hasValue() ? this.pending.value().length : 0,
  );

  private readonly items: NavItem[] = [
    { path: '/', label: 'Огляд', icon: 'dashboard', exact: true },
    { path: '/employees', label: 'Працівники', icon: 'users' },
    { path: '/notifications', label: 'Повідомлення ТЦК', icon: 'send' },
    { path: '/letters', label: 'Вихідні листи', icon: 'mail' },
    { path: '/reports/lists', label: 'Списки (Дод. 5)', icon: 'table' },
    { path: '/reports/operational', label: 'Відомість (Дод. 12)', icon: 'file' },
    { path: '/settings', label: 'Налаштування', icon: 'settings' },
  ];
  protected readonly nav = computed(() =>
    this.items.filter((i) => !i.adminOnly || this.auth.isAdmin()),
  );
}

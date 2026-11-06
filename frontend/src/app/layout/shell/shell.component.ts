import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  untracked,
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
import { BillingNoticeComponent } from '../../shared/components/billing-notice/billing-notice.component';
import type { BillingStatus } from '../../shared/interfaces/billing.interface';
import { BillingService } from '../../shared/services/billing.service';
import type { InboxItem } from '../../shared/interfaces/inbox.interface';
import { NavigationStateService } from '../../shared/services/navigation-state.service';
import { CommandPaletteComponent } from '../command-palette/command-palette.component';
import { DictionariesService } from '../../shared/services/dictionaries.service';
import { legalEntityName } from '../../shared/utils/legal-entity.utils';
import type { NavGroup } from '../../shared/interfaces/ui.interface';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    InboxListComponent,
    CommandPaletteComponent,
    BillingNoticeComponent,
  ],
  host: {
    '(document:keydown.escape)': 'closeInbox()',
    '(document:keydown)': 'onShortcut($event)',
  },
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly dict = inject(DictionariesService);
  protected readonly menuOpen = signal(false);
  /** Indicator shown while resolvers load data of the next page. */
  protected readonly isNavigating = inject(NavigationStateService).isNavigating;
  /** Sign-out after 10 minutes without mouse / keyboard activity (only in the browser). */
  protected readonly idle = inject(IdleTimeoutService);

  /** In-app notifications: the bell (panel) and the window with the new ones after a sign-in. */
  protected readonly inbox = inject(InboxService);
  private readonly router = inject(Router);
  protected readonly inboxOpen = signal(false);
  protected readonly paletteOpen = signal(false);
  protected readonly profileOpen = signal(false);
  protected readonly today = new Intl.DateTimeFormat('uk-UA', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  /** Company name under the app title: the only legal entity, or how many there are. */
  protected readonly orgName = computed(() => {
    const entities = this.dict.legalEntities();
    if (entities.length === 1) return legalEntityName(entities[0]);
    return entities.length ? `${entities.length} юридичні особи` : '';
  });
  protected readonly welcomeOpen = signal(false);
  private readonly billingService = inject(BillingService);
  /** Debt check after a sign-in; null — not loaded (the window then shows only the notifications). */
  protected readonly billing = signal<BillingStatus | null>(null);
  private readonly billingChecked = signal(false);
  protected readonly userName = computed(() => this.auth.user()?.fullName.trim() ?? '');
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
    // refreshed at most once a minute while moving between pages; always fresh on the dashboard
    effect(() => {
      this.navigationTick();
      if (!this.auth.isAuthenticated() || this.auth.mustChangePassword()) return;
      void this.inbox.refresh(untracked(() => this.router.url) === '/' ? 0 : 60_000);
    });
    // right after a sign-in: check the debt for using the system
    effect(() => {
      if (!this.auth.justSignedIn() || this.auth.mustChangePassword()) return;
      untracked(() => void this.loadBilling());
    });
    // …then show the window once: «Ласкаво просимо» / «Є заборгованість» and the new notifications
    effect(() => {
      if (!this.auth.justSignedIn() || !this.inbox.loaded() || !this.billingChecked()) return;
      this.auth.justSignedIn.set(false);
      if (!this.auth.mustChangePassword() && (this.billing() || this.inbox.unreadCount() > 0))
        this.welcomeOpen.set(true);
    });
  }

  private async loadBilling() {
    this.billingChecked.set(false);
    try {
      this.billing.set(await this.billingService.status());
    } catch {
      this.billing.set(null);
    } finally {
      this.billingChecked.set(true);
    }
  }

  protected toggleInbox() {
    this.inboxOpen.update((v) => !v);
  }

  protected closeInbox() {
    this.inboxOpen.set(false);
    this.welcomeOpen.set(false);
    this.profileOpen.set(false);
  }

  /** Ctrl K / ⌘K — global search. */
  protected onShortcut(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.paletteOpen.set(true);
    }
  }

  protected logout() {
    this.profileOpen.set(false);
    void this.auth.logout();
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

  private readonly groups: NavGroup[] = [
    {
      title: 'Робота',
      items: [
        { path: '/', label: 'Огляд', icon: 'dashboard', exact: true },
        { path: '/employees', label: 'Працівники', icon: 'users' },
        { path: '/notifications', label: 'Повідомлення ТЦК', icon: 'send' },
        { path: '/letters', label: 'Вихідні листи', icon: 'mail' },
      ],
    },
    {
      title: 'Звітність',
      items: [
        { path: '/reports/lists', label: 'Списки (Дод. 5)', icon: 'table' },
        { path: '/reports/operational', label: 'Відомість (Дод. 12)', icon: 'file' },
        { path: '/reports/extracts', label: 'Витяги для ТЦК', icon: 'copy' },
      ],
    },
    {
      title: 'Довідники',
      items: [{ path: '/tck', label: 'Довідник ТЦК', icon: 'flag' }],
    },
  ];
  /** Without a legal entity there is nothing to open yet — no menu (the director adds his legal entity first). */
  protected readonly navGroups = computed(() =>
    this.auth.needsEntity()
      ? []
      : this.groups.map((g) => ({
          ...g,
          items: g.items.filter((i) => !i.adminOnly || this.auth.isAdmin()),
        })),
  );
}

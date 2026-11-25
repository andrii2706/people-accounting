import { UiIdleHostComponent, UiIdleService } from '@mr/ui';
import { PlatformLocation } from '@angular/common';
import { REPORT_NAMES } from '../../shared/constants/lists.constants';
import { CopyrightComponent } from '../../shared/components/copyright/copyright.component';
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
import { AppIconComponent } from '../../shared/components/app-icon/app-icon.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AccountService } from '../../shared/services/account.service';
import { AuthService } from '../../shared/services/auth.service';
import { EmployeesService } from '../../shared/services/employees.service';
import { InboxService } from '../../shared/services/inbox.service';
import { InboxListComponent } from '../../shared/components/inbox-list/inbox-list.component';
import { BillingNoticeComponent } from '../../shared/components/billing-notice/billing-notice.component';
import type { BillingStatus } from '../../shared/interfaces/billing.interface';
import { BillingService } from '../../shared/services/billing.service';
import type { InboxItem } from '../../shared/interfaces/inbox.interface';
import { NavigationStateService } from '../../shared/services/navigation-state.service';
import { CommandPaletteComponent } from '../command-palette/command-palette.component';
import { DictionariesService } from '../../shared/services/dictionaries.service';
import { legalEntitiesCount, legalEntityName } from '../../shared/utils/legal-entity.utils';
import { readyAppsOf } from '../../../platform/contracts/apps';
import type { NavGroup } from '../../shared/interfaces/ui.interface';
import { A11Y_SETTINGS_URL, A11ySettingsService, UiIconComponent } from '@mr/ui';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiIdleHostComponent,
    UiIconComponent,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AppIconComponent,
    IconComponent,
    InboxListComponent,
    CommandPaletteComponent,
    BillingNoticeComponent,
    CopyrightComponent,
  ],
  host: {
    '(document:keydown.escape)': 'closeInbox()',
    '(document:keydown)': 'onShortcut($event)',
  },
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly a11y = inject(A11ySettingsService);
  /** «Доступність» lives in the portal (one domain — the choice works here at once) */
  protected readonly a11yUrl = A11Y_SETTINGS_URL;
  protected readonly account = inject(AccountService);
  private readonly dict = inject(DictionariesService);
  protected readonly menuOpen = signal(false);
  /** Indicator shown while resolvers load data of the next page. */
  protected readonly isNavigating = inject(NavigationStateService).isNavigating;
  /** Sign-out after 10 minutes without mouse / keyboard activity (only in the browser). */
  private readonly idle = inject(UiIdleService);

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
  /**
   * Company name under the app title: the user's legal entity. Only the main administrator sees how many legal
   * entities the system holds — nobody else learns about the other clients.
   */
  protected readonly orgName = computed(() => {
    const entities = this.dict.legalEntities();
    if (!this.auth.isAdmin()) {
      const own = entities.find((e) => e.id === this.auth.user()?.legalEntityId) ?? entities[0];
      return own ? legalEntityName(own) : '';
    }
    if (entities.length === 1) return legalEntityName(entities[0]);
    return entities.length ? legalEntitiesCount(entities.length) : '';
  });
  private readonly baseHref = inject(PlatformLocation).getBaseHrefFromDOM() || '/';
  /** The application behind the gateway of the domain (/oblik/): the portal is there. */
  protected readonly behindPortal = () => this.baseHref !== '/';
  /**
   * Behind the gateway of the domain (base href «/oblik/») — links to the portal and the other applications
   * of the account; when the application has the domain to itself there are none.
   */
  protected readonly otherApps = computed(() => {
    if (this.baseHref === '/') return [];
    const apps = readyAppsOf(this.auth.user()?.modules).filter((a) => a.id !== 'oblik');
    return [{ id: 'portal', title: 'Портал', path: '/' }, ...apps];
  });
  protected readonly welcomeOpen = signal(false);
  private readonly billingService = inject(BillingService);
  /** Debt check after a sign-in; null — not loaded (the window then shows only the notifications). */
  protected readonly billing = signal<BillingStatus | null>(null);
  private readonly billingChecked = signal(false);
  /** The welcome after a sign-in addresses the person in the vocative («п. Галино»), never «Галина Петренко». */
  protected readonly userAddress = computed(() => this.auth.user()?.address ?? '');
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
    afterNextRender(() => this.idle.start({ expire: () => this.auth.idleLogout() }));
    inject(DestroyRef).onDestroy(() => {
      this.idle.stop();
      this.inbox.reset();
    });
    // refresh after every navigation — the data could have changed (a card saved, a letter sent)
    // refreshed at most once a minute while moving between pages; always fresh on the dashboard
    effect(() => {
      this.navigationTick();
      if (!this.auth.isAuthenticated() || !this.auth.onboarded()) return;
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
      item.link === 'NOTICES'
        ? ['/notifications']
        : item.link === 'QUOTA'
          ? ['/settings/legal-entities', item.legalEntityId, 'quota']
          : ['/employees', item.employeeId],
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

  // re-request the counter after every navigation; not requested before the temporary password is changed,
  // the agreement accepted and the legal entity added
  private readonly pending = inject(EmployeesService).pendingChangesResource(() =>
    !this.auth.onboarded() || this.auth.needsEntity() ? undefined : this.navigationTick(),
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
        { path: '/reports/lists', label: REPORT_NAMES.lists, icon: 'table' },
        { path: '/reports/operational', label: REPORT_NAMES.operational, icon: 'file' },
        { path: '/reports/extracts', label: REPORT_NAMES.extracts, icon: 'copy' },
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

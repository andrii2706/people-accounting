import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import { addDays, formatUa, todayIso, yearOf } from '../common/utils/dates.utils.js';
import { buildInvoice } from '../documents/invoice.builder.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import type {
  BillingSettingsView,
  BuyerDetails,
  InvoiceView,
  PlanCode,
  PlanOffer,
  SellerDetails,
  SubscriptionView,
  TermsDocument,
  VendorSubscriptionRow,
} from '../shared/interfaces/subscription.interface.js';
import { User } from '../users/user.entity.js';
import { BillingSettings } from './billing-settings.entity.js';
import { Invoice } from './invoice.entity.js';
import { Subscription } from './subscription.entity.js';
import { SubscriptionGateService } from './subscription-gate.service.js';
import {
  BILLING_SETTINGS_ID,
  DEFAULT_DUE_DAYS,
  DEFAULT_INVOICE_PREFIX,
  DEFAULT_SERVICE_NAME,
  DEFAULT_TRIAL_DAYS,
  EMPTY_SELLER,
  PLAN_CODES,
  PLAN_DESCRIPTIONS,
  PLAN_LABELS,
  PLAN_MONTHS,
  PLAN_PERIODS,
  SUBSCRIPTION_MANAGERS,
} from './subscriptions.constants.js';
import type { BillingSettingsDto, VendorInvoiceDto } from './subscriptions.dto.js';
import { TERMS_INTRO, TERMS_SECTIONS, TERMS_TITLE, TERMS_VERSION } from './terms.constants.js';
import {
  daysLeft,
  invoiceNumber,
  missingSellerFields,
  nextPeriod,
  paidUntilAfter,
  subscriptionState,
  vatSplit,
} from './utils/subscription.utils.js';

const ENTITY_NOT_FOUND = 'Юридичну особу не знайдено';

/**
 * Subscriptions of the legal entities that signed up themselves: the plan, the free period, the invoices.
 * The client chooses a plan and gets an invoice; the vendor sets the prices and the requisites and marks the
 * invoices paid — that extends the access.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription) private readonly subs: Repository<Subscription>,
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    @InjectRepository(BillingSettings) private readonly settingsRepo: Repository<BillingSettings>,
    @InjectRepository(LegalEntity) private readonly entities: Repository<LegalEntity>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly gate: SubscriptionGateService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────── settings of the vendor ─────────────

  private async settingsRow(): Promise<BillingSettings> {
    const found = await this.settingsRepo.findOneBy({ id: BILLING_SETTINGS_ID });
    return (
      found ??
      this.settingsRepo.save(
        this.settingsRepo.create({
          id: BILLING_SETTINGS_ID,
          serviceName: DEFAULT_SERVICE_NAME,
          invoicePrefix: DEFAULT_INVOICE_PREFIX,
          dueDays: DEFAULT_DUE_DAYS,
          trialDays: DEFAULT_TRIAL_DAYS,
        }),
      )
    );
  }

  private toSettingsView(row: BillingSettings): BillingSettingsView {
    const seller: SellerDetails = { ...EMPTY_SELLER, ...(row.seller ?? {}) };
    return {
      seller,
      monthlyPrice: row.monthlyPrice,
      yearlyPrice: row.yearlyPrice,
      enterpriseText: row.enterpriseText,
      serviceName: row.serviceName || DEFAULT_SERVICE_NAME,
      invoicePrefix: row.invoicePrefix,
      dueDays: row.dueDays,
      trialDays: row.trialDays,
      ready: missingSellerFields(seller).length === 0,
    };
  }

  async settings(): Promise<BillingSettingsView> {
    return this.toSettingsView(await this.settingsRow());
  }

  async updateSettings(dto: BillingSettingsDto, by: AuthUser): Promise<BillingSettingsView> {
    const row = await this.settingsRow();
    row.seller = { ...dto.seller, iban: dto.seller.iban.replace(/\s/g, '').toUpperCase() };
    row.monthlyPrice = dto.monthlyPrice;
    row.yearlyPrice = dto.yearlyPrice;
    row.enterpriseText = dto.enterpriseText.trim();
    row.serviceName = dto.serviceName.trim() || DEFAULT_SERVICE_NAME;
    row.invoicePrefix = dto.invoicePrefix.trim();
    row.dueDays = dto.dueDays;
    row.trialDays = dto.trialDays;
    row.updatedBy = by.email;
    await this.settingsRepo.save(row);
    await this.audit.log('billing-settings', null, 'UPDATE', {}, by);
    return this.toSettingsView(row);
  }

  private plans(view: BillingSettingsView): PlanOffer[] {
    const price: Record<PlanCode, number | null> = {
      MONTHLY: view.monthlyPrice,
      YEARLY: view.yearlyPrice,
      ENTERPRISE: null,
    };
    return PLAN_CODES.map((plan) => ({
      plan,
      label: PLAN_LABELS[plan],
      price: price[plan],
      period: PLAN_PERIODS[plan],
      description: plan === 'ENTERPRISE' && view.enterpriseText ? view.enterpriseText : PLAN_DESCRIPTIONS[plan],
    }));
  }

  // ───────────── the agreement ─────────────

  async terms(): Promise<TermsDocument> {
    const { seller } = await this.settings();
    return {
      version: TERMS_VERSION,
      title: TERMS_TITLE,
      intro: TERMS_INTRO.replace('{seller}', seller.name || 'Виконавець'),
      sections: TERMS_SECTIONS,
      seller,
    };
  }

  // ───────────── the client ─────────────

  private async entityOf(user: AuthUser): Promise<LegalEntity | null> {
    return user.legalEntityId ? this.entities.findOneBy({ id: user.legalEntityId }) : null;
  }

  private toInvoiceView(i: Invoice): InvoiceView {
    return {
      id: i.id,
      number: i.number,
      plan: i.plan,
      periodFrom: i.periodFrom,
      periodTo: i.periodTo,
      issuedAt: i.issuedAt,
      dueDate: i.dueDate,
      total: i.total,
      vatAmount: i.vatAmount,
      status: i.status,
      paidAt: i.paidAt,
      legalEntityId: i.legalEntityId,
      buyerName: i.buyer?.name ?? '',
    };
  }

  /** What the client sees on the payment page. */
  async view(user: AuthUser): Promise<SubscriptionView> {
    const today = todayIso();
    const [entity, settings] = await Promise.all([this.entityOf(user), this.settings()]);
    const sub = entity ? await this.subs.findOneBy({ legalEntityId: entity.id }) : null;
    const invoices = sub
      ? await this.invoices.find({ where: { subscriptionId: sub.id }, order: { issuedAt: 'DESC', sequence: 'DESC' } })
      : [];
    return {
      required: !!entity?.billingRequired,
      state: subscriptionState(sub, today),
      plan: sub?.plan ?? null,
      trialUntil: sub?.trialUntil ?? null,
      paidUntil: sub?.paidUntil ?? null,
      daysLeft: daysLeft(sub, today),
      enterpriseRequestedAt: sub?.enterpriseRequestedAt?.toISOString() ?? null,
      plans: this.plans(settings),
      invoices: invoices.map((i) => this.toInvoiceView(i)),
      canManage: SUBSCRIPTION_MANAGERS.includes(user.role) && !!entity?.billingRequired,
      sellerReady: settings.ready,
    };
  }

  private assertManager(user: AuthUser, entity: LegalEntity | null): asserts entity is LegalEntity {
    if (!entity) throw new ForbiddenException('Спершу додайте свою юридичну особу');
    if (!entity.billingRequired) {
      throw new BadRequestException('Ваша юридична особа працює за окремим договором — тариф обирати не потрібно');
    }
    if (!SUBSCRIPTION_MANAGERS.includes(user.role)) {
      throw new ForbiddenException('Тариф обирає керівник або адміністратор юрособи');
    }
  }

  /**
   * The plan of the legal entity. The free period counts from the sign-up of its director. MONTHLY / YEARLY —
   * an invoice for the next period at once (the previous unpaid one is cancelled); ENTERPRISE — a request
   * to the vendor, who agrees the terms and issues the invoice himself.
   */
  async choosePlan(user: AuthUser, plan: PlanCode, note = ''): Promise<SubscriptionView> {
    const entity = await this.entityOf(user);
    this.assertManager(user, entity);
    const settings = await this.settings();
    if (plan !== 'ENTERPRISE' && (plan === 'MONTHLY' ? settings.monthlyPrice : settings.yearlyPrice) === null) {
      throw new BadRequestException('Цей тариф ще не доступний — оберіть інший або зверніться до постачальника');
    }

    let sub = await this.subs.findOneBy({ legalEntityId: entity.id });
    if (!sub) {
      const owner = await this.users.findOneBy({ id: user.id });
      const registered = (owner?.createdAt ?? new Date()).toISOString().slice(0, 10);
      sub = this.subs.create({
        legalEntityId: entity.id,
        ownerUserId: user.id,
        plan,
        trialUntil: addDays(registered, Math.max(0, settings.trialDays - 1)),
        paidUntil: null,
      });
    }
    const before = sub.plan;
    sub.plan = plan;
    if (plan === 'ENTERPRISE') {
      sub.enterpriseRequestedAt = new Date();
      sub.enterpriseNote = note.trim();
    }
    sub = await this.subs.save(sub);
    this.gate.forget(entity.id);
    await this.audit.log('subscription', sub.id, 'UPDATE', { plan: [before === plan ? null : before, plan] }, user);

    if (plan === 'ENTERPRISE') {
      await this.notifyVendor(
        `Заявка Enterprise: ${entity.shortName || entity.fullName}`,
        [
          `Юрособа: ${entity.fullName} (ЄДРПОУ ${entity.edrpou})`,
          `Хто: ${user.fullName}, ${user.email}`,
          note.trim() ? `Побажання: ${note.trim()}` : '',
          `Пробний період до ${formatUa(sub.trialUntil)}. Погодьте умови й виставте рахунок у розділі «Підписки».`,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    } else if (settings.ready) {
      await this.invoices.update({ subscriptionId: sub.id, status: 'ISSUED' }, { status: 'CANCELLED' });
      await this.issue(sub, entity, plan, PLAN_MONTHS[plan], this.planPrice(settings, plan), user);
    }
    return this.view(user);
  }

  private planPrice(settings: BillingSettingsView, plan: Exclude<PlanCode, 'ENTERPRISE'>): number {
    const price = plan === 'MONTHLY' ? settings.monthlyPrice : settings.yearlyPrice;
    if (price === null) throw new BadRequestException('Ціну тарифу ще не встановлено');
    return price;
  }

  /** An invoice for the next period of the current plan; an unpaid one already issued is returned instead. */
  async renew(user: AuthUser): Promise<InvoiceView> {
    const entity = await this.entityOf(user);
    this.assertManager(user, entity);
    const sub = await this.subs.findOneBy({ legalEntityId: entity.id });
    if (!sub) throw new BadRequestException('Спершу оберіть тариф');
    if (sub.plan === 'ENTERPRISE') {
      throw new BadRequestException('Рахунок за тарифом Enterprise виставляє постачальник після погодження умов');
    }
    const open = await this.invoices.findOne({ where: { subscriptionId: sub.id, status: 'ISSUED' } });
    if (open) return this.toInvoiceView(open);
    const settings = await this.settings();
    if (!settings.ready)
      throw new BadRequestException('Постачальник ще не заповнив реквізити — рахунок буде доступний згодом');
    return this.toInvoiceView(
      await this.issue(sub, entity, sub.plan, PLAN_MONTHS[sub.plan], this.planPrice(settings, sub.plan), user),
    );
  }

  /** The .docx of an invoice: the managers of its legal entity, the main administrator and the vendor. */
  async invoiceFile(id: string, user: AuthUser) {
    const inv = await this.invoices.findOneBy({ id });
    const own = inv && user.legalEntityId === inv.legalEntityId && SUBSCRIPTION_MANAGERS.includes(user.role);
    if (!inv || !(own || user.role === 'ADMIN' || user.role === 'VENDOR')) {
      throw new NotFoundException('Рахунок не знайдено');
    }
    return { buffer: await buildInvoice(inv), filename: `Рахунок ${inv.number}.docx` };
  }

  // ───────────── the vendor ─────────────

  async list(): Promise<VendorSubscriptionRow[]> {
    const today = todayIso();
    const subs = await this.subs.find({ order: { createdAt: 'DESC' } });
    const entityIds = subs.map((s) => s.legalEntityId);
    const ownerIds = subs.map((s) => s.ownerUserId).filter((x): x is string => !!x);
    const [entities, owners, unpaid] = await Promise.all([
      entityIds.length ? this.entities.findBy({ id: In(entityIds) }) : [],
      ownerIds.length ? this.users.findBy({ id: In(ownerIds) }) : [],
      this.invoices
        .createQueryBuilder('i')
        .select('i.subscriptionId', 'subscriptionId')
        .addSelect('COUNT(*)', 'count')
        .where(`i.status = 'ISSUED'`)
        .groupBy('i.subscriptionId')
        .getRawMany<{ subscriptionId: string; count: string }>(),
    ]);
    const entityById = new Map(entities.map((e) => [e.id, e]));
    const ownerById = new Map(owners.map((u) => [u.id, u]));
    const unpaidBySub = new Map(unpaid.map((r) => [r.subscriptionId, Number(r.count)]));
    return subs.map((s) => {
      const e = entityById.get(s.legalEntityId);
      const o = s.ownerUserId ? ownerById.get(s.ownerUserId) : undefined;
      return {
        id: s.id,
        legalEntityId: s.legalEntityId,
        entityName: e ? e.shortName || e.fullName : '—',
        entityCode: e?.edrpou ?? '',
        ownerName: o?.fullName ?? '',
        ownerEmail: o?.email ?? '',
        plan: s.plan,
        state: subscriptionState(s, today),
        trialUntil: s.trialUntil,
        paidUntil: s.paidUntil,
        enterpriseRequestedAt: s.enterpriseRequestedAt?.toISOString() ?? null,
        enterpriseNote: s.enterpriseNote,
        unpaidInvoices: unpaidBySub.get(s.id) ?? 0,
        createdAt: s.createdAt.toISOString(),
      };
    });
  }

  async vendorInvoices(subscriptionId?: string): Promise<InvoiceView[]> {
    const rows = await this.invoices.find({
      where: subscriptionId ? { subscriptionId } : {},
      order: { issuedAt: 'DESC', sequence: 'DESC' },
      take: 500,
    });
    return rows.map((i) => this.toInvoiceView(i));
  }

  private async subscription(id: string): Promise<Subscription> {
    const sub = await this.subs.findOneBy({ id });
    if (!sub) throw new NotFoundException('Підписку не знайдено');
    return sub;
  }

  async extendTrial(id: string, until: string, by: AuthUser) {
    const sub = await this.subscription(id);
    const before = sub.trialUntil;
    sub.trialUntil = until;
    await this.subs.save(sub);
    this.gate.forget(sub.legalEntityId);
    await this.audit.log('subscription', sub.id, 'UPDATE', { trialUntil: [before, until] }, by);
    return (await this.list()).find((r) => r.id === id)!;
  }

  /** An invoice by hand: Enterprise or special terms — any amount, 1–36 months. */
  async vendorInvoice(id: string, dto: VendorInvoiceDto, by: AuthUser): Promise<InvoiceView> {
    const sub = await this.subscription(id);
    const entity = await this.entities.findOneBy({ id: sub.legalEntityId });
    if (!entity) throw new NotFoundException(ENTITY_NOT_FOUND);
    const settings = await this.settings();
    if (!settings.ready) {
      throw new BadRequestException(
        `Заповніть реквізити постачальника: ${missingSellerFields(settings.seller).join(', ')}`,
      );
    }
    return this.toInvoiceView(await this.issue(sub, entity, sub.plan, dto.months, dto.total, by, dto.description));
  }

  /** The money came: the access is extended to the end of the invoice period. */
  async markPaid(invoiceId: string, paidAt: string | undefined, by: AuthUser): Promise<InvoiceView> {
    const inv = await this.invoices.findOneBy({ id: invoiceId });
    if (!inv) throw new NotFoundException('Рахунок не знайдено');
    if (inv.status !== 'ISSUED') throw new BadRequestException('Оплаченим можна позначити лише виставлений рахунок');
    if (!inv.subscriptionId) throw new BadRequestException('Підписку цього рахунку видалено разом з юрособою');
    const sub = await this.subscription(inv.subscriptionId);
    inv.status = 'PAID';
    inv.paidAt = paidAt ?? todayIso();
    const before = sub.paidUntil;
    sub.paidUntil = paidUntilAfter(sub.paidUntil, inv.periodTo);
    sub.plan = inv.plan;
    await this.dataSource.transaction(async (m) => {
      await m.save(inv);
      await m.save(sub);
    });
    this.gate.forget(sub.legalEntityId);
    await this.audit.log(
      'invoice',
      inv.id,
      'UPDATE',
      { status: ['ISSUED', 'PAID'], paidUntil: [before, sub.paidUntil] },
      by,
    );
    return this.toInvoiceView(inv);
  }

  async cancel(invoiceId: string, by: AuthUser): Promise<InvoiceView> {
    const inv = await this.invoices.findOneBy({ id: invoiceId });
    if (!inv) throw new NotFoundException('Рахунок не знайдено');
    if (inv.status !== 'ISSUED') throw new BadRequestException('Скасувати можна лише неоплачений рахунок');
    inv.status = 'CANCELLED';
    await this.invoices.save(inv);
    await this.audit.log('invoice', inv.id, 'UPDATE', { status: ['ISSUED', 'CANCELLED'] }, by);
    return this.toInvoiceView(inv);
  }

  // ───────────── issuing ─────────────

  private buyer(entity: LegalEntity): BuyerDetails {
    return { name: entity.fullName, code: entity.edrpou, address: entity.address, phone: entity.phone };
  }

  /**
   * A new invoice with the next number of the year (one at a time — an advisory lock per year).
   * The seller and the buyer are copied into it.
   */
  private async issue(
    sub: Subscription,
    entity: LegalEntity,
    plan: PlanCode,
    months: number,
    total: number,
    by: AuthUser,
    description?: string,
  ): Promise<Invoice> {
    const settings = await this.settings();
    const today = todayIso();
    const period = nextPeriod(sub, today, months);
    const amounts = vatSplit(total, settings.seller.vatPayer);
    const year = yearOf(today);
    const line =
      description?.trim() ||
      `${settings.serviceName}, тариф «${PLAN_LABELS[plan]}», період з ${formatUa(period.from)} по ${formatUa(period.to)}`;

    const saved = await this.dataSource.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`invoices:${year}`]);
      const last = await m
        .getRepository(Invoice)
        .createQueryBuilder('i')
        .select('COALESCE(MAX(i.sequence), 0)', 'max')
        .where('i.year = :year', { year })
        .getRawOne<{ max: number | string }>();
      const sequence = Number(last?.max ?? 0) + 1;
      return m.getRepository(Invoice).save(
        m.getRepository(Invoice).create({
          year,
          sequence,
          number: invoiceNumber(settings.invoicePrefix, year, sequence),
          subscriptionId: sub.id,
          legalEntityId: entity.id,
          plan,
          periodFrom: period.from,
          periodTo: period.to,
          description: line,
          ...amounts,
          issuedAt: today,
          dueDate: addDays(today, settings.dueDays),
          status: 'ISSUED',
          seller: settings.seller,
          buyer: this.buyer(entity),
          createdBy: by.email,
        }),
      );
    });
    await this.audit.log(
      'invoice',
      saved.id,
      'CREATE',
      { number: [null, saved.number], total: [null, saved.total] },
      by,
    );
    return saved;
  }

  /** Letters to the vendor: the vendor accounts and the e-mail of the seller. */
  private async notifyVendor(subject: string, text: string) {
    const [vendors, settings] = await Promise.all([
      this.users.find({ where: { role: 'VENDOR', isActive: true }, select: { email: true } }),
      this.settings(),
    ]);
    const to = [...vendors.map((v) => v.email), settings.seller.email].filter(Boolean);
    if (!to.length || !(await this.notifications.sendTo(to, subject, text))) {
      this.logger.warn(`Лист постачальнику не надіслано: ${subject}`);
    }
  }
}

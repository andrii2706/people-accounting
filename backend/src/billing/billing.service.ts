import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, type Repository } from 'typeorm';
import { User } from '../users/user.entity.js';
import type { BillingLoginGate, BillingRecord, BillingStatus } from '../shared/interfaces/billing.interface.js';
import { BillingStatusEntity } from './billing-status.entity.js';
import { BILLING_CACHE_MS, BILLING_ROW_ID } from './billing.constants.js';
import type { UpdateBillingDto } from './billing.dto.js';
import { graceUsed, sessionGate, toBillingStatus } from './utils/billing.utils.js';

/**
 * Debt for using the system. The sign-in is never blocked (the portal tells why a module is closed);
 * while there is a debt every user (not the vendor) gets one session with the module open — the following
 * ones see the module closed until the vendor clears the debt.
 */
@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillingStatusEntity) private readonly repo: Repository<BillingStatusEntity>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private cached: { row: BillingStatusEntity; at: number } | null = null;

  private async row(): Promise<BillingStatusEntity> {
    const found = await this.repo.findOneBy({ id: BILLING_ROW_ID });
    return found ?? this.repo.save(this.repo.create({ id: BILLING_ROW_ID }));
  }

  async status(): Promise<BillingStatus> {
    return toBillingStatus(await this.row());
  }

  async record(): Promise<BillingRecord> {
    const row = await this.row();
    const graceUsedBy =
      row.hasDebt && row.debtSetAt
        ? await this.users
            .createQueryBuilder('u')
            .where('u.role <> :vendor', { vendor: 'VENDOR' })
            .andWhere('u.debtGraceUsedAt >= :since', { since: row.debtSetAt })
            .getCount()
        : 0;
    return {
      hasDebt: row.hasDebt,
      amount: row.amount === null ? null : Number(row.amount),
      debtSince: row.debtSince,
      paymentContact: row.paymentContact,
      debtSetAt: row.debtSetAt?.toISOString() ?? null,
      updatedAt: row.updatedAt?.toISOString() ?? null,
      updatedBy: row.updatedBy,
      graceUsedBy,
    };
  }

  /** Switching the debt on starts a new period: every user gets one entry again. */
  async update(dto: UpdateBillingDto, updatedBy: string): Promise<BillingRecord> {
    const row = await this.row();
    const switchedOn = dto.hasDebt && !row.hasDebt;
    row.hasDebt = dto.hasDebt;
    if (dto.amount !== undefined) row.amount = dto.amount === null ? null : dto.amount.toFixed(2);
    if (dto.debtSince !== undefined) row.debtSince = dto.debtSince || null;
    if (dto.paymentContact !== undefined) row.paymentContact = dto.paymentContact.trim();
    if (switchedOn) row.debtSetAt = new Date();
    if (!dto.hasDebt) row.debtSetAt = null;
    row.updatedBy = updatedBy;
    await this.repo.save(row);
    this.cached = null;
    return this.record();
  }

  /** The debt state for the guard, kept for half a minute (asked on every request). */
  private async debtState(): Promise<BillingStatusEntity> {
    if (this.cached && Date.now() - this.cached.at < BILLING_CACHE_MS) return this.cached.row;
    const row = await this.row();
    this.cached = { row, at: Date.now() };
    return row;
  }

  /** May this session use the module (the AuthGuard and the portal ask). */
  async sessionGate(
    user: Pick<User, 'role' | 'debtGraceUsedAt'>,
    sessionStartSec: number,
  ): Promise<{ gate: BillingLoginGate; contact: string }> {
    const row = await this.debtState();
    return { gate: sessionGate(row, user, sessionStartSec), contact: row.paymentContact };
  }

  /**
   * Called after the password check: records the one-time entry of a debt. The sign-in goes on whatever it
   * answers — the guard closes the module for the later sessions.
   */
  async loginGate(user: Pick<User, 'id' | 'role' | 'debtGraceUsedAt'>): Promise<BillingLoginGate> {
    if (user.role === 'VENDOR') return 'ok';
    const row = await this.row();
    if (!row.hasDebt) return 'ok';
    if (graceUsed(user.debtGraceUsedAt, row.debtSetAt)) return 'blocked';
    await this.users.update({ id: user.id, role: Not('VENDOR') }, { debtGraceUsedAt: new Date() });
    return 'grace';
  }

  /** Payment contact for the «sign-in blocked» message. */
  async paymentContact(): Promise<string> {
    return (await this.row()).paymentContact;
  }
}

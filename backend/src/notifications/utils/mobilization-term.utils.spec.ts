import { describe, expect, it } from 'vitest';
import type { MobilizationState } from '../../shared/interfaces/document.interface.js';
import { applyMobilizationCheck } from './mobilization-term.utils.js';

const confirmed: MobilizationState = {
  until: '2026-11-03',
  confirmedUntil: '2026-11-03',
  decree: 'Указ Президента України № 597/2026 від 13.07.2026',
  estimated: false,
};
const decree = (from: string, until: string) => ({ from, days: 90, until, decree: '№ 1061/2026 від 26.10.2026' });

describe('строк мобілізації: щоразу 90 діб', () => {
  it('строк ще не минув і нового указу нема — нічого не змінюється', () => {
    expect(applyMobilizationCheck(confirmed, null, '2026-11-01')).toEqual({ state: confirmed, event: null });
  });

  it('строк минув, указу не знайдено — +90 діб з позначкою «очікується указ»', () => {
    const { state, event } = applyMobilizationCheck(confirmed, null, '2026-11-04');
    expect(event).toBe('estimated');
    expect(state).toMatchObject({ until: '2027-02-01', confirmedUntil: '2026-11-03', estimated: true });
    expect(state.decree).toBe(confirmed.decree);
  });

  it('довго не перевіряли — додається стільки разів по 90, скільки треба', () => {
    const { state } = applyMobilizationCheck(confirmed, null, '2027-03-01');
    expect(state.until).toBe('2027-05-02');
  });

  it('указ на той самий строк підтверджує оцінку', () => {
    const estimated = applyMobilizationCheck(confirmed, null, '2026-11-04').state;
    const { state, event } = applyMobilizationCheck(estimated, decree('2026-11-03', '2027-02-01'), '2026-11-10');
    expect(event).toBe('confirmed');
    expect(state).toMatchObject({ until: '2027-02-01', confirmedUntil: '2027-02-01', estimated: false });
    expect(state.decree).toContain('1061/2026');
  });

  it('указ на інший строк — береться дата з указу', () => {
    const estimated = applyMobilizationCheck(confirmed, null, '2026-11-04').state;
    const { state, event } = applyMobilizationCheck(estimated, decree('2026-11-03', '2027-01-15'), '2026-11-10');
    expect(event).toBe('decree');
    expect(state).toMatchObject({ until: '2027-01-15', estimated: false });
  });

  it('старий указ (той самий, що вже підтверджено) не скасовує оцінку', () => {
    const estimated = applyMobilizationCheck(confirmed, null, '2026-11-04').state;
    const { state, event } = applyMobilizationCheck(estimated, decree('2026-08-05', '2026-11-03'), '2026-11-10');
    expect(event).toBeNull();
    expect(state).toEqual(estimated);
  });

  it('строку ще не було — береться з указу', () => {
    const empty: MobilizationState = { until: null, confirmedUntil: null, decree: '', estimated: false };
    expect(applyMobilizationCheck(empty, decree('2026-11-03', '2027-02-01'), '2026-11-10').state.until).toBe(
      '2027-02-01',
    );
  });
});

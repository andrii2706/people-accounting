import { emptyEmployeeForm } from './employee-form.utils';
import { changedCount, completion, sectionKeyFields } from './employee-form-sections.utils';

const TODAY = '2026-11-03';

describe('картка: розділи', () => {
  it('порожня картка заповнена частково (дата прийняття вже стоїть)', () => {
    const m = emptyEmployeeForm(TODAY);
    expect(completion(m)).toBeGreaterThan(0);
    expect(completion(m)).toBeLessThan(20);
    expect(sectionKeyFields(m).notes).toEqual([]);
  });

  it('не на обліку — військовий розділ не рахується', () => {
    const m = { ...emptyEmployeeForm(TODAY), militaryRegistered: false };
    expect(sectionKeyFields(m).military).toEqual([]);
  });

  it('незбережені зміни: кількість змінених полів', () => {
    const before = emptyEmployeeForm(TODAY);
    expect(changedCount(null, before)).toBe(0);
    expect(changedCount(before, { ...before, phone: '+380', notes: 'x', changeBasis: 'y' })).toBe(
      2,
    );
  });
});

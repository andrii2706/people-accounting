import type { Employee } from '../interfaces/employee.interface';
import type { EmployeeFormModel } from '../interfaces/employee-form.interface';
import {
  copyEmployeeToForm,
  effectiveDeferral,
  emptyEducation,
  emptyEmployeeForm,
  employeeToForm,
  formToPayload,
  normalizeTime,
  reportableChanges,
} from './employee-form.utils';

const TODAY = '2026-11-02';
const form = (patch: Partial<EmployeeFormModel> = {}): EmployeeFormModel => ({
  ...emptyEmployeeForm(TODAY),
  lastName: 'Тестенко',
  firstName: 'Іван',
  rankCode: '2',
  ...patch,
});
const payload = (patch: Partial<EmployeeFormModel> = {}) =>
  formToPayload(form(patch), false) as unknown as Record<string, unknown>;

describe('employee form model', () => {
  describe('formToPayload', () => {
    it('порожні дати → null, звання → число, ВОС без дефісів', () => {
      const p = payload({ birthDate: '', vos: '100-915 а' });
      expect(p['birthDate']).toBeNull();
      expect(p['rankCode']).toBe(2);
      expect(p['vos']).toBe('100915А');
    });

    it('наступна ВЛК — лише разом з відстрочкою', () => {
      const vlk = { fitnessDate: '2026-05-01', nextVlkDate: '2026-11-01' };
      expect(payload(vlk)['nextVlkDate']).toBeNull();
      expect(
        payload({ ...vlk, deferralKind: 'MOBILIZATION', deferralMobilizationBasis: 'п. 9' })[
          'nextVlkDate'
        ],
      ).toBe('2026-11-01');
      expect(
        payload({
          ...vlk,
          reserved: true,
          deferralKind: 'MOBILIZATION',
          deferralMobilizationBasis: 'п. 9',
        })['nextVlkDate'],
      ).toBeNull();
    });

    it('ID-картка не має серії', () => {
      expect(payload({ passportType: 'ID_CARD', passportSeries: 'кв' })['passportSeries']).toBe('');
      expect(payload({ passportType: 'BOOK', passportSeries: 'кв' })['passportSeries']).toBe('КВ');
    });

    it('без відмітки «заброньований» дані бронювання не надсилаються', () => {
      const p = payload({
        reserved: false,
        reservationUntil: '2027-01-01',
        specialAccountingCertificate: '1',
      });
      expect(p).toMatchObject({
        reserved: false,
        reservationUntil: null,
        specialAccountingCertificate: '',
      });
    });

    it('«інша юрособа» — поля необов’язкові і зберігаються як є', () => {
      const p = payload({
        reserved: true,
        reservedBy: 'OTHER',
        reservedByName: 'ТОВ «Інша»',
        reservationUntil: '',
      });
      expect(p).toMatchObject({ reservedBy: 'OTHER', reservedByName: 'ТОВ «Інша»' });
    });

    it('порожні освіти й посади не надсилаються, час е-документа нормалізується', () => {
      const p = payload({
        educations: [
          emptyEducation(),
          { ...emptyEducation(), level: 'Повна вища освіта', institution: ' ЛНУ ' },
        ],
        militaryDocuments: [
          { ...emptyDocument(), type: 'військовий квиток', number: '1', generatedTime: '915' },
        ],
      });
      expect(p['educations']).toEqual([
        {
          level: 'Повна вища освіта',
          institution: 'ЛНУ',
          specialty: '',
          document: '',
          documentDate: null,
        },
      ]);
      expect((p['militaryDocuments'] as { generatedTime: string }[])[0].generatedTime).toBe(
        '09:15',
      );
      expect('deferralKind' in p).toBe(false);
    });
  });

  describe('відстрочка', () => {
    it('заброньований працівник відстрочки не має', () => {
      const d = effectiveDeferral(
        form({ reserved: true, deferralKind: 'MOBILIZATION', deferralMobilizationBasis: 'п. 9' }),
      );
      expect(d).toEqual({
        deferralConscriptionBasis: '',
        deferralMobilizationBasis: '',
        deferralUntil: null,
        deferralUntilMobilizationEnd: false,
      });
    });

    it('зберігається лише обраний вид', () => {
      const m = form({
        deferralKind: 'CONSCRIPTION',
        deferralConscriptionBasis: 'ст. 17',
        deferralMobilizationBasis: 'п. 9',
        deferralUntil: '2027-01-01',
      });
      expect(effectiveDeferral(m)).toMatchObject({
        deferralConscriptionBasis: 'ст. 17',
        deferralMobilizationBasis: '',
        deferralUntil: '2027-01-01',
      });
    });

    it('«до завершення мобілізації» — без дати', () => {
      const m = form({
        deferralKind: 'MOBILIZATION',
        deferralMobilizationBasis: 'п. 9',
        deferralUntil: '2027-01-01',
        deferralUntilMobilizationEnd: true,
      });
      expect(effectiveDeferral(m)).toMatchObject({
        deferralUntil: null,
        deferralUntilMobilizationEnd: true,
      });
    });
  });

  describe('employeeToForm', () => {
    const employee = {
      lastName: 'Тестенко',
      firstName: 'Іван',
      rankCode: 14,
      position: 'інженер',
      hireDate: '2020-01-01',
      educationLevel: 'Повна вища освіта',
      educationSpecialty: 'Енергетика',
      deferralMobilizationBasis: 'п. 9',
      militaryDocuments: [],
      positions: [],
      familyMembers: [],
    } as unknown as Employee;

    it('старі картки: освіта й посада з полів картки стають першим записом', () => {
      const m = employeeToForm(employee, TODAY);
      expect(m.rankCode).toBe('14');
      expect(m.educations[0]).toMatchObject({
        level: 'Повна вища освіта',
        specialty: 'Енергетика',
      });
      expect(m.positions[0]).toMatchObject({ position: 'інженер', since: '2020-01-01' });
    });

    it('вид відстрочки визначається з заповненої підстави', () => {
      expect(employeeToForm(employee, TODAY).deferralKind).toBe('MOBILIZATION');
    });

    it('копія картки — усі дані, крім звільнення', () => {
      const m = copyEmployeeToForm(
        { ...employee, rnokpp: '3287300019', dismissalDate: '2026-10-01' } as Employee,
        TODAY,
      );
      expect(m.lastName).toBe('Тестенко');
      expect(m.rnokpp).toBe('3287300019');
      expect(m.rankCode).toBe('14');
      expect(m.deferralKind).toBe('MOBILIZATION');
      expect(m.positions[0]).toMatchObject({ position: 'інженер' });
      expect(m.dismissalDate).toBe('');
    });
  });

  it('зміни для ТЦК: адреса — так, примітки — ні', () => {
    const before = form();
    expect(reportableChanges(before, { ...before, notes: 'x' })).toEqual([]);
    expect(reportableChanges(before, { ...before, actualAddress: 'м. Львів' }).length).toBe(1);
    expect(reportableChanges(null, before)).toEqual([]);
  });

  it('час: «915», «9.15», «09:15» → «09:15»', () => {
    expect(normalizeTime('915')).toBe('09:15');
    expect(normalizeTime('9.15')).toBe('09:15');
    expect(normalizeTime('09:15')).toBe('09:15');
    expect(normalizeTime('ранок')).toBe('ранок');
  });
});

function emptyDocument() {
  return {
    type: '',
    series: '',
    number: '',
    issuedBy: '',
    issuedAt: '',
    generatedDate: '',
    generatedTime: '',
  };
}

import { EMPTY_LEGAL_ENTITY } from '../constants/legal-entity.constants';
import { legalEntitiesCount, legalEntityBody, legalEntityToForm } from './legal-entity.utils';
import type { LegalEntity } from '../interfaces/legal-entity.interface';

describe('legalEntityBody', () => {
  it('квота: відсоток числом, порожні дати документа — null', () => {
    const body = legalEntityBody({
      ...EMPTY_LEGAL_ENTITY,
      reservationQuotaPercent: '12,5',
      reservationQuotaDocName: '  Рішення про критичність ',
      reservationQuotaDocDate: '',
      reservationQuotaValidUntil: '2027-03-31',
    });
    expect(body.reservationQuotaPercent).toBe(12.5);
    expect(body.reservationQuotaDocName).toBe('Рішення про критичність');
    expect(body.reservationQuotaDocDate).toBeNull();
    expect(body.reservationQuotaValidUntil).toBe('2027-03-31');
  });
});

describe('legalEntityToForm', () => {
  it('null-дати стають порожніми рядками форми', () => {
    const form = legalEntityToForm({
      ...legalEntityBody(EMPTY_LEGAL_ENTITY),
      id: 'x',
      headUserId: null,
      responsibleUserId: null,
      reservationQuotaDocDate: null,
      reservationQuotaValidUntil: '2027-01-01',
    } as LegalEntity);
    expect(form.reservationQuotaDocDate).toBe('');
    expect(form.reservationQuotaValidUntil).toBe('2027-01-01');
  });
});

describe('кількість юросіб (бачить лише головний адміністратор)', () => {
  it('узгоджує число з іменником', () => {
    expect(legalEntitiesCount(1)).toBe('1 юридична особа');
    expect(legalEntitiesCount(3)).toBe('3 юридичні особи');
    expect(legalEntitiesCount(5)).toBe('5 юридичних осіб');
    expect(legalEntitiesCount(12)).toBe('12 юридичних осіб');
    expect(legalEntitiesCount(22)).toBe('22 юридичні особи');
  });
});

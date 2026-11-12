import { EMPTY_LEGAL_ENTITY } from '../constants/legal-entity.constants';
import { legalEntityBody, legalEntityToForm } from './legal-entity.utils';
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

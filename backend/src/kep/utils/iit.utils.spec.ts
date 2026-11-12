import { describe, expect, it } from 'vitest';
import { signerFromIit } from './iit.utils.js';

describe('signerFromIit', () => {
  it('ПІБ, ЄДРПОУ, замаскований РНОКПП і час з позначки часу', () => {
    const s = signerFromIit({
      ownerInfo: {
        subjFullName: ' Тестовий Керівник Іванович ',
        subjCN: 'інше',
        subjEDRPOUCode: '12345678',
        subjDRFOCode: '1234567890',
        issuerCN: 'Тестовий надавач',
        serial: 'AB',
      },
      timeInfo: { isTimeAvail: true, time: '2026-11-12T10:00:00Z' },
    });
    expect(s).toEqual({
      fullName: 'Тестовий Керівник Іванович',
      edrpou: '12345678',
      drfoMasked: '••••••7890',
      issuer: 'Тестовий надавач',
      serial: 'AB',
      signedAt: new Date('2026-11-12T10:00:00Z'),
    });
  });

  it('без subjFullName — commonName; без часу — null', () => {
    const s = signerFromIit({ ownerInfo: { subjCN: 'Тестовий Керівник' }, timeInfo: { isTimeAvail: false } });
    expect(s.fullName).toBe('Тестовий Керівник');
    expect(s.signedAt).toBeNull();
    expect(s.drfoMasked).toBe('');
  });
});

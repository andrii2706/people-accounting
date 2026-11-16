import type { JkPipeEntry } from 'jkurwa';
import { describe, expect, it } from 'vitest';
import { DSTU_ERRORS } from '../kep.constants.js';
import { dstuFailure, signerFromDstu } from './dstu.utils.js';

/** A verified signer as jkurwa reports it (fictional person and provider). */
const entry = (subject: Record<string, string>, ipn: { EDRPOU?: string; DRFO?: string } | null = null) =>
  ({
    signed: true,
    signingTime: Date.parse('2026-11-12T10:00:00Z'),
    cert: {
      subject,
      issuer: { organizationName: 'Тестовий надавач', commonName: 'КНЕДП Тест' },
      extension: { ipn },
      usage: { sign: true, encrypt: false },
      verified: true,
    },
  }) as JkPipeEntry;

describe('підписувач з сертифіката (jkurwa)', () => {
  it('ПІБ, ЄДРПОУ, замаскований РНОКПП, надавач і час підпису', () => {
    const s = signerFromDstu(
      entry({ commonName: ' Тестовий Керівник Іванович ' }, { EDRPOU: '12345678', DRFO: '1234567890' }),
      'AB',
    );
    expect(s).toEqual({
      fullName: 'Тестовий Керівник Іванович',
      edrpou: '12345678',
      drfoMasked: '••••••7890',
      issuer: 'КНЕДП Тест',
      serial: 'AB',
      signedAt: new Date('2026-11-12T10:00:00Z'),
    });
  });

  it('без commonName — прізвище й ім’я; коди — з полів subject', () => {
    const s = signerFromDstu(
      entry({
        surname: 'Тестовий',
        givenName: 'Керівник Іванович',
        serialNumber: 'TINUA-1234567890',
        organizationIdentifier: 'NTRUA-87654321',
      }),
      '01',
    );
    expect(s.fullName).toBe('Тестовий Керівник Іванович');
    expect(s.edrpou).toBe('87654321');
    expect(s.drfoMasked).toBe('••••••7890');
  });
});

describe('причина відмови', () => {
  it('підпис і ланцюжок у порядку — немає причини', () => {
    expect(dstuFailure(undefined, entry({ commonName: 'Тест' }))).toBeNull();
  });

  it('немає сертифіката, зламаний підпис, не кваліфікований надавач', () => {
    expect(dstuFailure('ENOCERT', { signed: true, error: 'ENOCERT' })).toBe(DSTU_ERRORS.noCert);
    expect(dstuFailure('ESIGN', { broken_sign: true, error: 'ESIGN' })).toBe(DSTU_ERRORS.badSignature);
    expect(dstuFailure('ESIGN', { broken_cert: true, error: 'ESIGN' })).toBe(DSTU_ERRORS.notQualified);
  });
});

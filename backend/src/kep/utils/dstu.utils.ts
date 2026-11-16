import type { JkPipeEntry } from 'jkurwa';
import type { KepSigner } from '../../shared/interfaces/kep.interface.js';
import { maskDrfo } from '../../signatures/utils/cms.utils.js';
import { DSTU_ERRORS } from '../kep.constants.js';

const EDRPOU_IN_SUBJECT = /NTRUA-(\d{8})/;
const DRFO_IN_SUBJECT = /TINUA-(\d{10})/;

function asDate(value: number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A verified signer of jkurwa → the signer (the RNOKPP is masked at once and never kept in full). */
export function signerFromDstu(entry: JkPipeEntry, serial: string): KepSigner {
  const subject = entry.cert?.subject ?? {};
  const issuer = entry.cert?.issuer ?? {};
  const ipn = entry.cert?.extension.ipn ?? {};
  const fullName = subject['commonName'] || [subject['surname'], subject['givenName']].filter(Boolean).join(' ') || '';
  const edrpou = ipn.EDRPOU || EDRPOU_IN_SUBJECT.exec(subject['organizationIdentifier'] ?? '')?.[1] || '';
  const drfo = ipn.DRFO || DRFO_IN_SUBJECT.exec(subject['serialNumber'] ?? '')?.[1] || '';
  return {
    fullName: fullName.trim(),
    edrpou: edrpou.trim(),
    drfoMasked: drfo ? maskDrfo(drfo) : '',
    issuer: issuer['commonName'] || issuer['organizationName'] || '',
    serial,
    signedAt: asDate(entry.tokenTime) ?? asDate(entry.contentTime) ?? asDate(entry.signingTime),
  };
}

/** The failure of a jkurwa pipe → a message for the user (null — the signature is fine). */
export function dstuFailure(error: string | undefined, entry: JkPipeEntry | undefined): string | null {
  if (!error && entry?.signed === true && entry.cert?.verified === true) return null;
  if (error === 'ENOCERT') return DSTU_ERRORS.noCert;
  if (error === 'EOCSP') return DSTU_ERRORS.ocspUnavailable;
  if (entry?.broken_sign) return DSTU_ERRORS.badSignature;
  if (entry?.broken_cert || entry?.cert?.verified === false) return DSTU_ERRORS.notQualified;
  return DSTU_ERRORS.badSignature;
}

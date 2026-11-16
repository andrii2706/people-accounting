import type { JkPipeEntry } from 'jkurwa';
import type { IitSignInfo } from '../../shared/interfaces/kep.interface.js';
import { DSTU_ERRORS } from '../kep.constants.js';

const EDRPOU_IN_SUBJECT = /NTRUA-(\d{8})/;
const DRFO_IN_SUBJECT = /TINUA-(\d{10})/;

function asDate(value: number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A verified signer of jkurwa → the shape of the IIT EndUserSignInfo, so both verifiers end in the same
 * `signerFromIit` (one place that masks the RNOKPP and builds the signer).
 */
export function signInfoFromDstu(entry: JkPipeEntry, serial: string): IitSignInfo {
  const subject = entry.cert?.subject ?? {};
  const issuer = entry.cert?.issuer ?? {};
  const ipn = entry.cert?.extension.ipn ?? {};
  const fullName = subject['commonName'] || [subject['surname'], subject['givenName']].filter(Boolean).join(' ') || '';
  const edrpou = ipn.EDRPOU || EDRPOU_IN_SUBJECT.exec(subject['organizationIdentifier'] ?? '')?.[1] || '';
  const drfo = ipn.DRFO || DRFO_IN_SUBJECT.exec(subject['serialNumber'] ?? '')?.[1] || '';
  const time = asDate(entry.tokenTime) ?? asDate(entry.contentTime) ?? asDate(entry.signingTime);
  return {
    ownerInfo: {
      subjFullName: fullName,
      subjEDRPOUCode: edrpou,
      subjDRFOCode: drfo,
      issuerCN: issuer['commonName'] || issuer['organizationName'] || '',
      serial,
    },
    timeInfo: time ? { isTimeAvail: true, time } : { isTimeAvail: false },
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

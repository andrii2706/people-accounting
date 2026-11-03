import type { ParsedSigner, SignerSummary } from '../../shared/interfaces/signature.interface.js';

/** Parsed CMS signer → what the API and the documents show. */
export function signerSummary(s: ParsedSigner): SignerSummary {
  const c = s.certificate;
  const name = c ? c.commonName || [c.surname, c.givenName].filter(Boolean).join(' ') : '';
  return {
    name: name || 'Невідомий підписувач',
    title: c?.title ?? '',
    organization: c?.organization ?? '',
    edrpou: c?.edrpou ?? '',
    drfoMasked: c?.drfoMasked ?? '',
    issuer: c?.issuer ?? '',
    certificateSerial: c?.serialNumber ?? '',
    certificateValidFrom: c?.validFrom.toISOString() ?? '',
    certificateValidTo: c?.validTo.toISOString() ?? '',
    signingTime: s.signingTime?.toISOString() ?? null,
    hasTimestamp: s.hasTimestamp,
    digestAlgorithm: s.digestAlgorithm,
    signatureAlgorithm: s.signatureAlgorithm,
    verification: s.verification,
    notes: s.notes,
  };
}

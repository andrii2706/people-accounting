import type { IitSignInfo, KepSigner } from '../../shared/interfaces/kep.interface.js';
import { maskDrfo } from '../../signatures/utils/cms.utils.js';

/** EndUserSignInfo of the IIT library → the signer (the RNOKPP is masked at once). */
export function signerFromIit(info: IitSignInfo): KepSigner {
  const owner = info.ownerInfo ?? {};
  const time = info.timeInfo;
  return {
    fullName: (owner.subjFullName || owner.subjCN || '').trim(),
    edrpou: (owner.subjEDRPOUCode ?? '').trim(),
    drfoMasked: owner.subjDRFOCode ? maskDrfo(owner.subjDRFOCode) : '',
    issuer: owner.issuerCN ?? '',
    serial: owner.serial ?? '',
    signedAt: time?.isTimeAvail && time.time ? new Date(time.time) : null,
  };
}

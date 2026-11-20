import { SECURITY_DETAIL_LABELS, UPLOAD_REASON_TEXT } from '../constants/security.constants';
import type { SecurityEventView } from '../interfaces/security.interface';

/** «спроб: 24 · облікових записів: 4» — the details of an event in words. */
export function securityDetails(event: Pick<SecurityEventView, 'details'>): string {
  return Object.entries(event.details)
    .map(([key, value]) => {
      const shown =
        key === 'reason' ? (UPLOAD_REASON_TEXT[String(value)] ?? String(value)) : String(value);
      return `${SECURITY_DETAIL_LABELS[key] ?? key}: ${shown}`;
    })
    .join(' · ');
}

/** SHA-256 of a file, computed in the browser (the file itself is not sent anywhere). */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

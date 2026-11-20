import type { TwoFactorSetup } from '../../../platform/contracts/session';

/** The QR grid → one SVG path of 1×1 squares (with the quiet zone of 4 cells around it). */
export function qrPath(qr: TwoFactorSetup['qr'], margin = 4): string {
  const parts: string[] = [];
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.cells[y * qr.size + x] === '1') parts.push(`M${x + margin} ${y + margin}h1v1h-1z`);
    }
  }
  return parts.join('');
}

/** What a person types: «123 456», «k7qm-9xda» → «123456», «K7QM-9XDA». */
export function normalizeCode(value: string): string {
  const v = value.trim().toUpperCase().replace(/\s+/g, '');
  if (/^\d{6}$/.test(v)) return v;
  const plain = v.replace(/-/g, '');
  return /^[2-9A-HJ-NP-Z]{8}$/.test(plain) ? `${plain.slice(0, 4)}-${plain.slice(4)}` : v;
}

/** A code from the app (6 digits) or a recovery code (XXXX-XXXX). */
export const isCodeLike = (value: string) =>
  /^(\d{6}|[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4})$/.test(normalizeCode(value));

/** The text file with the recovery codes. */
export function recoveryCodesText(codes: string[], email: string, at = new Date()): string {
  const when = at.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  return [
    'Резервні коди для входу — Військовий облік',
    `Обліковий запис: ${email}`,
    `Створено: ${when}`,
    '',
    'Кожен код діє один раз — якщо телефон з застосунком загубився.',
    'Зберігайте їх окремо від пароля (надрукуйте або в менеджері паролів).',
    '',
    ...codes.map((c, i) => `${String(i + 1).padStart(2, ' ')}. ${c}`),
    '',
  ].join('\r\n');
}

import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { BLOCKED_IPV4, BLOCKED_IPV6 } from '../entity-databases.constants.js';

const blocked = new BlockList();
for (const [net, prefix] of BLOCKED_IPV4) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of BLOCKED_IPV6) blocked.addSubnet(net, prefix, 'ipv6');

/** A loopback / private / link-local / metadata / reserved address (IPv4-mapped IPv6 included). */
export function isPrivateAddress(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return blocked.check(mapped[1], 'ipv4');
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, 'ipv4');
  if (family === 6) return blocked.check(ip, 'ipv6');
  return true;
}

/** A host name or an IP address as typed in the form. */
export const HOST_PATTERN =
  /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$|^[0-9a-fA-F:.]+$/;

/**
 * Resolves the host once and checks every address. The connection then goes to the checked address
 * (not to the name again) — a DNS answer cannot change between the check and the connection.
 */
export async function resolvePublicHost(host: string, allowPrivate: boolean): Promise<string> {
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length) throw new Error('Адресу сервера не знайдено');
  if (!allowPrivate) {
    const bad = addresses.find((a) => isPrivateAddress(a.address));
    if (bad) throw new Error('Адреса сервера веде у внутрішню мережу — вкажіть публічну адресу бази даних');
  }
  return addresses[0].address;
}

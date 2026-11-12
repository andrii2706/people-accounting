import type { DbSslMode } from '../shared/interfaces/entity-database.interface.js';

export const DB_SSL_MODES: DbSslMode[] = ['require', 'verify-full', 'disable'];

/** A check may not hang the request. */
export const DB_CONNECT_TIMEOUT_MS = 8_000;
export const DB_QUERY_TIMEOUT_MS = 5_000;

/** Ports below are system services, not PostgreSQL. */
export const DB_MIN_PORT = 1024;

/**
 * Addresses a client database may not point to: the cloud's own network and metadata server, loopback,
 * private and reserved ranges (otherwise the form becomes a way to probe the internal network).
 */
export const BLOCKED_IPV4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

export const BLOCKED_IPV6: [string, number][] = [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

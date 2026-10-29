export interface Organization {
  fullName: string;
  nameLocative: string;
  shortName: string;
  edrpou: string;
  address: string;
  postalCode: string;
  phone: string;
  email: string;
  headPosition: string;
  headName: string;
  letterNumberPrefix: string;
  alertDays: number;
  notifyDeadlineDays: number;
  /** Reservation quota; null — not set. */
  reservationQuota?: number | null;
  reservationQuotaBasis?: string;
  /** General mobilization lasts until (from the presidential decrees). */
  mobilizationUntil?: string | null;
  mobilizationDecree?: string;
  mobilizationSource?: string;
  mobilizationCheckedAt?: string | null;
  /** Extra e-mail addresses for reminders, comma-separated. */
  notifyEmails?: string;
}

/** Head (director) for a period — signs documents dated within it. */
export interface OrganizationHead {
  id: string;
  position: string;
  fullName: string;
  orderNumber: string;
  validFrom: string;
  validTo: string | null;
}

export interface NotificationStatus {
  mailConfigured: boolean;
  recipients: number;
  mobilizationUntil: string | null;
  mobilizationDecree: string;
  mobilizationCheckedAt: string | null;
}

export interface DecreeCheckResult {
  ok: boolean;
  until?: string;
  decree?: string;
  changed?: boolean;
  message?: string;
}

export interface ResponsiblePerson {
  id: string;
  fullName: string;
  position: string;
  phone: string;
  orderNumber: string;
  validFrom: string;
  validTo: string | null;
}

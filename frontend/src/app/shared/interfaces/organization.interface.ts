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

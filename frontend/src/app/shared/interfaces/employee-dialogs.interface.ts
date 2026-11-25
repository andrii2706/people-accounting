/** «Змінити контакти й адреси»: the new values and when they changed. */
export interface ContactsChangeForm {
  phone: string;
  email: string;
  registeredAddress: string;
  actualAddress: string;
  /** The actual address is the registered one — stored empty. */
  sameAsRegistered: boolean;
  effectiveDate: string;
  basis: string;
}

/** «Новий паспорт». */
export interface PassportChangeForm {
  passportType: 'ID_CARD' | 'BOOK';
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssuedAt: string;
  effectiveDate: string;
  basis: string;
  /** Queue the notice to the TCK (into the combined letter). */
  notify: boolean;
}

/** «Змінити ТЦК (місце обліку)». */
export interface TckChangeForm {
  tckId: string;
  tckRegisteredAt: string;
  basis: string;
}

/** A TCK added from the card (the directory entry, only what a letter needs). */
export interface NewTckForm {
  name: string;
  nameGenitive: string;
  postalCode: string;
  address: string;
  phone: string;
  email: string;
}

/** Where the notice will go: the combined letter of the TCK — how much is in it already. */
export interface NoticeDraftInfo {
  tckName: string;
  notices: number;
  employees: number;
}

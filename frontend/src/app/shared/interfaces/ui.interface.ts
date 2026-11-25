import type { ICON_PATHS } from '../constants/icons.constants';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Second line in the list (e.g. the composition of a rank). */
  hint?: string;
}

/** Structural type of a Signal Forms field, so it does not depend on the value type. */
export type FieldLike = () => {
  touched: () => boolean;
  errors: () => readonly { message?: string }[];
};

export type IconName = keyof typeof ICON_PATHS;

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  adminOnly?: boolean;
}

export interface InfoRow {
  label: string;
  value: string;
  /** «з 12.11.2026» — since when the value is in force. */
  since?: string;
  /** A button next to the label that opens the window changing this value. */
  action?: { label: string; dialog: EmployeeDialog };
  /** A muted line under the value. */
  note?: string;
  /** Earlier values (the TCKs before). */
  earlier?: string[];
  /** The value is a stand-in (e.g. «як зареєстроване»), shown muted. */
  muted?: boolean;
}

/** The windows of the employee card that change one part of it with the date of the change. */
export type EmployeeDialog = 'contacts' | 'passport' | 'tck';

/** One line of the global search (Ctrl K): an employee or a quick action. */
export interface PaletteEntry {
  id: string;
  icon: IconName;
  title: string;
  hint: string;
  go: () => unknown;
}

/** Group of items in the side menu («Робота», «Звітність»). */
export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Look of a status badge: text, Tailwind classes and an optional tooltip. */
export interface BadgeStyle {
  label: string;
  cls: string;
  hint?: string;
}

/** A day cell of the date picker calendar. */
export interface CalendarCell {
  day: number;
  iso: string;
  today: boolean;
  selected: boolean;
}

/** A titled block of rows on the employee card. */
export interface InfoSection {
  title: string;
  rows: InfoRow[];
}

/** A view in the report switch (full lists / extracts). */
export interface ReportView {
  path: string;
  label: string;
  icon: IconName;
  hint: string;
}

/**
 * One item of a row's «⋯» menu: an action, a page of the app or a file.
 * Items the user may not use are simply left out; a `danger` item goes last, after a divider.
 */
export interface MenuAction {
  label: string;
  icon?: IconName;
  /** Destructive (block, delete, cancel) — red, separated from the rest. */
  danger?: boolean;
  disabled?: boolean;
  /** A second line: why the item is disabled or what exactly it does. */
  hint?: string;
  /** A page of the app (routerLink). */
  link?: string | readonly unknown[];
  /** A file to download. */
  href?: string;
  run?: () => unknown;
}

/** Where the open menu stands (position: fixed — a table that scrolls sideways does not cut it off). */
export interface MenuPosition {
  right: number;
  top: number | null;
  bottom: number | null;
}

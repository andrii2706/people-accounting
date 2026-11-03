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

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

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
}

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

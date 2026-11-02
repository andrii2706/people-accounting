import type { PATHS } from '../components/icon/icon.component';

export interface SelectOption {
  value: string;
  label: string;
  /** Second line in the list (e.g. the composition of a rank). */
  hint?: string;
}

/** Structural type of a Signal Forms field, so it does not depend on the value type. */
export type FieldLike = () => {
  touched: () => boolean;
  errors: () => readonly { message?: string }[];
};

export type IconName = keyof typeof PATHS;

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

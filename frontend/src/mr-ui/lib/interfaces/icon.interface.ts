import type { ICON_PATHS } from '../constants/icons.constants';

/** The name of an icon of the set. */
export type UiIconName = keyof typeof ICON_PATHS;

/** The applications of the platform: the portal and its modules. */
export type AppIconId = 'portal' | 'oblik' | 'kadry' | 'projects';

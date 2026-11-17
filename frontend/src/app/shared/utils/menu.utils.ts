import { MENU_GAP_PX, MENU_MIN_ROOM_BELOW_PX } from '../constants/menu.constants';
import type { MenuAction, MenuPosition } from '../interfaces/ui.interface';

/**
 * The menu is aligned to the right edge of its button; it opens downwards, or upwards when the button is
 * close to the bottom of the window and there is more room above.
 */
export function menuPosition(
  button: Pick<DOMRect, 'top' | 'bottom' | 'right'>,
  viewport: { width: number; height: number },
): MenuPosition {
  const right = Math.max(viewport.width - button.right, MENU_GAP_PX);
  const below = viewport.height - button.bottom;
  const upwards = below < MENU_MIN_ROOM_BELOW_PX && button.top > below;
  return upwards
    ? { right, top: null, bottom: viewport.height - button.top + MENU_GAP_PX }
    : { right, top: button.bottom + MENU_GAP_PX, bottom: null };
}

/** The ordinary items first, the destructive ones last (the divider goes between them). */
export function orderedActions(actions: readonly MenuAction[]): MenuAction[] {
  return [...actions.filter((a) => !a.danger), ...actions.filter((a) => a.danger)];
}

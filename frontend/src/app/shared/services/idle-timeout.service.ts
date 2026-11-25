/**
 * REMOVED since v108 — the idle timer is UiIdleService of @mr/ui (layout/shell starts it, ui-idle-host shows it).
 * A zip cannot delete files, so the old idle-timeout.service.ts stayed after unpacking and broke the build;
 * this stand-in replaces it so the build works. Delete it:  npm run cleanup  (in the root of the repository).
 */
export { UiIdleService as IdleTimeoutService } from '@mr/ui';

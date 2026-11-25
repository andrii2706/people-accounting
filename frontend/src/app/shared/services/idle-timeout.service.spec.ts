// REMOVED since v108 together with idle-timeout.service.ts — delete both:  npm run cleanup
import { UiIdleService } from '@mr/ui';
import { IdleTimeoutService } from './idle-timeout.service';

describe('idle-timeout.service (видалено)', () => {
  it('лише вказує на UiIdleService з @mr/ui', () => {
    expect(IdleTimeoutService).toBe(UiIdleService);
  });
});

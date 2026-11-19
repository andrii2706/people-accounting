import { apiPathOf, isApiUrl } from './api-url.utils';

describe('адреси API відносно <base href>', () => {
  it('запит до API — відносний «api/…» або старий «/api/…»', () => {
    expect(isApiUrl('api/employees')).toBe(true);
    expect(isApiUrl('/api/employees')).toBe(true);
    expect(isApiUrl('/apiary')).toBe(false);
    expect(isApiUrl('assets/logo.svg')).toBe(false);
  });

  it('шлях API без префікса застосунку (SSR за шлюзом)', () => {
    expect(apiPathOf('/oblik/api/employees', '/oblik/')).toBe('/api/employees');
    expect(apiPathOf('/api/employees', '/')).toBe('/api/employees');
    expect(apiPathOf('/oblik/employees', '/oblik/')).toBeNull();
  });
});

import { hasOblik, modulesLabel, toggleModule } from './modules.utils';

describe('modulesLabel', () => {
  it('the main administrator opens everything', () => {
    expect(modulesLabel('ADMIN', [])).toBe('усі модулі');
  });

  it('names the applications in the order of the domain', () => {
    expect(modulesLabel('HR', ['projects', 'kadry', 'oblik'])).toBe(
      'Військовий облік · Облік працівників · Керування проєктами',
    );
  });

  it('an account from before the portal — «Військовий облік»', () => {
    expect(modulesLabel('HR', undefined)).toBe('Військовий облік');
  });
});

describe('toggleModule', () => {
  it('adds in the order of the domain and removes', () => {
    expect(toggleModule(['kadry'], 'oblik')).toEqual(['oblik', 'kadry']);
    expect(toggleModule(['oblik', 'kadry'], 'oblik')).toEqual(['kadry']);
  });
});

describe('hasOblik', () => {
  it('the main administrator, an account with «облік», an older session without the list — yes', () => {
    expect(hasOblik({ role: 'ADMIN', modules: ['kadry'] })).toBe(true);
    expect(hasOblik({ role: 'HR', modules: ['oblik', 'kadry'] })).toBe(true);
    expect(hasOblik({ role: 'HR' })).toBe(true);
  });

  it('only other applications — no', () => {
    expect(hasOblik({ role: 'DIRECTOR', modules: ['kadry'] })).toBe(false);
  });
});

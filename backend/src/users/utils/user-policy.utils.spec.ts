import { describe, expect, it } from 'vitest';
import { canManage, issuableRoles, roleEntityProblem } from './user-policy.utils.js';

const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';

describe('ролі й юрособи', () => {
  it('головний адмін керує всіма й видає будь-яку роль', () => {
    expect(canManage({ role: 'ADMIN', legalEntityId: null }, { role: 'ENTITY_ADMIN', legalEntityId: B })).toBe(true);
    expect(issuableRoles({ role: 'ADMIN' })).toContain('ENTITY_ADMIN');
  });

  it('адмін юрособи й директор — лише кадровиків і директорів своєї юрособи', () => {
    for (const role of ['ENTITY_ADMIN', 'DIRECTOR'] as const) {
      const actor = { role, legalEntityId: A };
      expect(canManage(actor, { role: 'HR', legalEntityId: A })).toBe(true);
      expect(canManage(actor, { role: 'DIRECTOR', legalEntityId: A })).toBe(true);
      expect(canManage(actor, { role: 'ENTITY_ADMIN', legalEntityId: A })).toBe(false);
      expect(canManage(actor, { role: 'HR', legalEntityId: B })).toBe(false);
      expect(issuableRoles(actor)).toEqual(['HR', 'DIRECTOR']);
    }
  });

  it('кадровик не керує користувачами', () => {
    expect(canManage({ role: 'HR', legalEntityId: A }, { role: 'HR', legalEntityId: A })).toBe(false);
  });

  it('юрособа відповідно до ролі', () => {
    expect(roleEntityProblem('ADMIN', A)).not.toBeNull();
    expect(roleEntityProblem('HR', null)).toBe('Оберіть юридичну особу');
    expect(roleEntityProblem('ENTITY_ADMIN', null)).toBe('Оберіть юридичну особу');
    expect(roleEntityProblem('DIRECTOR', null)).toBeNull();
    expect(roleEntityProblem('HR', A)).toBeNull();
  });
});

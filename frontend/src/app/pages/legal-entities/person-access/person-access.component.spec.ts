import type { WritableSignal } from '@angular/core';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import { renderPage, submitEvent } from '../../../testing/page.testing';
import { PersonAccessComponent } from './person-access.component';

type State = {
  roleOptions: () => { value: string }[];
  grantModel: WritableSignal<{ email: string; role: string }>;
  grant: (e: Event) => Promise<void>;
  issued: () => { password: string; mailedTo: string } | null;
  revoke: () => Promise<void>;
  startChange: () => void;
  changing: () => boolean;
  changeModel: WritableSignal<Record<string, unknown>>;
  setChangeRole: (r: string) => void;
  setGrantRole: (r: string) => void;
  change: (e: Event) => Promise<void>;
  copyPassword: () => Promise<void>;
};

function render(
  person: 'HEAD' | 'RESPONSIBLE' = 'HEAD',
  opts: { confirm?: boolean; auth?: Record<string, unknown>; access?: object | null } = {},
) {
  const service = {
    grantAccess: vi.fn(async () => ({
      access: { userId: 'u9', email: 'head@example.com' },
      temporaryPassword: 'Tmp-0000-x',
      mailSent: true,
      expiresAt: '2026-11-27T10:00:00Z',
    })),
    revokeAccess: vi.fn(async () => ({ deactivated: true, email: 'head@example.com' })),
    changePerson: vi.fn(async () => ({ revoked: null, granted: null })),
  };
  const page = renderPage<PersonAccessComponent, State>(PersonAccessComponent, {
    inputs: {
      entityId: 'le1',
      person,
      personName: 'Вигаданий Директор',
      access:
        opts.access === undefined
          ? { userId: 'u1', email: 'old@example.com', role: 'DIRECTOR', isActive: true }
          : opts.access,
    },
    providers: [{ provide: LegalEntitiesService, useValue: service }],
    confirm: opts.confirm,
    auth: opts.auth,
  });
  const changed = vi.fn();
  page.fixture.componentInstance.changed.subscribe(changed);
  return { ...page, service, changed };
}

describe('PersonAccessComponent — доступ керівника / відповідального', () => {
  it('видати доступ: керівнику — роль директора, пароль показано раз', async () => {
    const { s, service, changed } = render();
    expect(s.grantModel().role).toBe('DIRECTOR');
    expect(s.roleOptions().map((o) => o.value)).not.toContain('ENTITY_ADMIN');
    s.grantModel.set({ email: 'head@example.com', role: 'DIRECTOR' });
    await s.grant(submitEvent());
    expect(service.grantAccess).toHaveBeenCalledWith('le1', 'HEAD', {
      email: 'head@example.com',
      role: 'DIRECTOR',
    });
    expect(s.issued()).toMatchObject({ password: 'Tmp-0000-x', mailedTo: 'head@example.com' });
    expect(changed).toHaveBeenCalled();
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
    await s.copyPassword();
  });

  it('наявний обліковий запис — без пароля; хибний email — не відправляє', async () => {
    const { s, service, toast } = render('RESPONSIBLE');
    expect(s.grantModel().role).toBe('HR');
    s.grantModel.set({ email: 'не-email', role: 'HR' });
    await s.grant(submitEvent());
    expect(service.grantAccess).not.toHaveBeenCalled();
    service.grantAccess.mockResolvedValueOnce({
      access: { userId: 'u2', email: 'r@example.com' },
      temporaryPassword: null,
    } as never);
    s.setGrantRole('HR');
    s.grantModel.set({ email: 'r@example.com', role: 'HR' });
    await s.grant(submitEvent());
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('пароль не змінено'));
  });

  it('скасувати доступ: з підтвердженням; вимкнено / лише відв’язано', async () => {
    const { s, service, toast } = render();
    await s.revoke();
    expect(toast.success).toHaveBeenCalledWith('Доступ head@example.com скасовано');
    service.revokeAccess.mockResolvedValueOnce({ deactivated: false, email: 'x@example.com' });
    await s.revoke();
    expect(toast.success).toHaveBeenLastCalledWith(expect.stringContaining('відв’язано'));
    service.revokeAccess.mockRejectedValueOnce(new Error('x'));
    await s.revoke();
    expect(toast.error).toHaveBeenCalled();
  });

  it('скасувати доступ — «Залишити» нічого не робить', async () => {
    const { s, service } = render('HEAD', { confirm: false });
    await s.revoke();
    expect(service.revokeAccess).not.toHaveBeenCalled();
  });

  it('нова людина: дані, телефон відповідального, доступ одразу', async () => {
    const { s, service, toast } = render('RESPONSIBLE', { auth: { isAdmin: () => true } });
    expect(s.roleOptions().map((o) => o.value)).toContain('ENTITY_ADMIN');
    s.startChange();
    expect(s.changing()).toBe(true);
    s.changeModel.update((m) => ({
      ...m,
      fullName: ' Нова Відповідальна ',
      position: 'Інспектор',
      phone: '+380501112233',
    }));
    s.setChangeRole('HR');
    await s.change(submitEvent());
    expect(service.changePerson).toHaveBeenCalledWith(
      'le1',
      'RESPONSIBLE',
      expect.objectContaining({ fullName: 'Нова Відповідальна', phone: '+380501112233' }),
    );
    expect(toast.success).toHaveBeenCalled();
    service.changePerson.mockResolvedValueOnce({
      revoked: null,
      granted: { access: { email: 'n@example.com' }, temporaryPassword: 'Tmp-1', mailSent: false },
    } as never);
    s.startChange();
    s.changeModel.update((m) => ({ ...m, fullName: 'Інша', email: 'n@example.com' }));
    await s.change(submitEvent());
    expect(s.issued()?.password).toBe('Tmp-1');
    s.startChange();
    await s.change(submitEvent());
    expect(service.changePerson).toHaveBeenCalledTimes(2);
  });
});

import { TestBed } from '@angular/core/testing';
import type { WritableSignal } from '@angular/core';
import type { ListSettingsPageData } from '../../../shared/interfaces/list-settings.interface';
import { ListsService } from '../../../shared/services/lists.service';
import { renderPage, submitEvent } from '../../../testing/page.testing';
import { ListSettingsComponent } from './list-settings.component';

const SECTION = {
  columns: ['number', 'fullName', 'birthDate'],
  sort: 'NAME',
  groupBy: 'NONE',
  title: '',
  subtitle: '',
  showOutgoing: true,
  signers: [],
  template: null,
};
const DATA = {
  entityId: 'le1',
  entityName: 'Вигадана компанія',
  settings: {
    OFFICERS: { ...SECTION },
    SOLDIERS: { ...SECTION },
    WOMEN: { ...SECTION },
    CONSCRIPTS: { ...SECTION },
  },
  placeholders: [],
} as unknown as ListSettingsPageData;

type State = {
  section: () => string;
  model: WritableSignal<Record<string, unknown> & { columns: string[]; signers: unknown[] }>;
  dirty: () => boolean;
  selectSection: (s: string) => Promise<void>;
  toggle: (k: string, e: Event) => void;
  reorder: (o: string[]) => void;
  allColumns: () => void;
  setSort: (v: string) => void;
  setGrouping: (v: string) => void;
  setShowOutgoing: (e: Event) => void;
  addSigner: () => void;
  removeSigner: (i: number) => void;
  reset: () => void;
  save: (e: Event) => Promise<void>;
  exampleUrl: () => string;
  templateUrl: () => string;
  upload: (e: Event) => Promise<void>;
  removeTemplate: () => Promise<void>;
  template: () => unknown;
};

function render(opts: { unsaved?: 'stay' | 'save' | 'discard'; confirm?: boolean } = {}) {
  const service = {
    save: vi.fn(async (_e: string, section: string, body: object) => ({
      ...DATA.settings,
      [section]: { ...SECTION, ...body },
    })),
    uploadTemplate: vi.fn(async () => ({
      ...DATA.settings,
      OFFICERS: {
        ...SECTION,
        template: { fileName: 'шаблон.docx', size: 100, key: 'k', uploadedAt: '' },
      },
    })),
    removeTemplate: vi.fn(async () => DATA.settings),
    exampleUrl: (e: string, s: string) => `api/legal-entities/${e}/list-settings/${s}/example`,
    templateUrl: (e: string, s: string) => `api/legal-entities/${e}/list-settings/${s}/template`,
  };
  const page = renderPage<ListSettingsComponent, State>(ListSettingsComponent, {
    inputs: { data: DATA },
    providers: [{ provide: ListsService, useValue: service }],
    ...opts,
  });
  return { ...page, service };
}

const checkbox = (checked: boolean) => ({ target: { checked } }) as unknown as Event;
const fileEvent = (name: string, size = 10) =>
  ({ target: { files: [new File(['x'.repeat(size)], name)], value: name } }) as unknown as Event;

describe('ListSettingsComponent — вигляд списків', () => {
  it('колонки, порядок, групування, вихідні листи, підписанти — і збереження', async () => {
    const { s, service, toast } = render();
    s.toggle('birthDate', checkbox(false));
    expect(s.model().columns).not.toContain('birthDate');
    s.reorder(['fullName', 'number']);
    expect(s.model().columns[0]).toBe('number');
    s.allColumns();
    expect(s.model().columns.length).toBeGreaterThan(3);
    s.setSort('BIRTH_DATE');
    s.setGrouping('TCK');
    s.setShowOutgoing(checkbox(false));
    s.addSigner();
    s.model.update((m) => ({ ...m, signers: [{ position: 'Директор', name: 'Іван ВИГАДАНИЙ' }] }));
    s.addSigner();
    s.removeSigner(1);
    expect(s.dirty()).toBe(true);
    await s.save(submitEvent());
    expect(service.save).toHaveBeenCalledWith(
      'le1',
      'OFFICERS',
      expect.objectContaining({ sort: 'BIRTH_DATE', groupBy: 'TCK', showOutgoing: false }),
    );
    expect(toast.success).toHaveBeenCalledWith('Вигляд списку збережено');
    expect(s.dirty()).toBe(false);
  });

  it('підписант без імені — не зберігає; скинути зміни', async () => {
    const { s, service } = render();
    s.addSigner();
    await s.save(submitEvent());
    expect(service.save).not.toHaveBeenCalled();
    s.reset();
    expect(s.dirty()).toBe(false);
  });

  it('інший список зі змінами: «залишитись» / «зберегти» / «не зберігати»', async () => {
    const stay = render({ unsaved: 'stay' });
    stay.s.setSort('BIRTH_DATE');
    await stay.s.selectSection('WOMEN');
    expect(stay.s.section()).toBe('OFFICERS');
    TestBed.resetTestingModule();
    const save = render({ unsaved: 'save' });
    save.s.setSort('BIRTH_DATE');
    await save.s.selectSection('WOMEN');
    expect(save.service.save).toHaveBeenCalled();
    expect(save.s.section()).toBe('WOMEN');
    TestBed.resetTestingModule();
    const discard = render();
    await discard.s.selectSection('WOMEN');
    await discard.s.selectSection('WOMEN');
    expect(discard.s.section()).toBe('WOMEN');
    expect(discard.s.exampleUrl()).toContain('/WOMEN/example');
    expect(discard.s.templateUrl()).toContain('/WOMEN/template');
  });

  it('власний шаблон: лише .docx до 2 МБ; незбережені правки лишаються; прибрати з підтвердженням', async () => {
    const { s, service, toast } = render();
    await s.upload(fileEvent('шаблон.pdf'));
    await s.upload(fileEvent('великий.docx', 3 * 1024 * 1024));
    expect(toast.error).toHaveBeenCalledTimes(2);
    s.setSort('BIRTH_DATE');
    await s.upload(fileEvent('шаблон.docx'));
    expect(service.uploadTemplate).toHaveBeenCalled();
    expect(s.template()).toBeTruthy();
    expect(s.model()['sort']).toBe('BIRTH_DATE');
    await s.removeTemplate();
    expect(service.removeTemplate).toHaveBeenCalled();
    service.uploadTemplate.mockRejectedValueOnce(new Error('У шаблоні невідома мітка'));
    await s.upload(fileEvent('шаблон.docx'));
    service.removeTemplate.mockRejectedValueOnce(new Error('x'));
    await s.removeTemplate();
    expect(toast.error).toHaveBeenCalledTimes(4);
  });

  it('прибрати шаблон — скасовано в діалозі', async () => {
    const { s, service } = render({ confirm: false });
    await s.removeTemplate();
    expect(service.removeTemplate).not.toHaveBeenCalled();
  });
});

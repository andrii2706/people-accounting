import { renderPage } from '../../../testing/page.testing';
import { SuggestInputComponent } from './suggest-input.component';

const OPTIONS = [
  { value: 't1', label: 'Шевченківський РТЦК та СП', hint: 'м. Київ' },
  { value: 't2', label: 'Шевченківський РТЦК та СП', hint: 'м. Львів' },
  { value: 't3', label: 'Галицький РТЦК та СП', hint: 'м. Львів' },
];

type State = {
  value: { (): string; set: (v: string) => void };
  open: () => boolean;
  active: () => number;
  matches: () => { value: string }[];
  onInput: (e: Event) => void;
  onFocus: () => void;
  onKeydown: (e: KeyboardEvent) => void;
  onDocumentClick: (e: MouseEvent) => void;
};

const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true });

function render(inputs: Record<string, unknown> = {}) {
  const page = renderPage<SuggestInputComponent, State>(SuggestInputComponent, {
    inputs: { options: OPTIONS, ...inputs },
  });
  const touched = vi.fn();
  page.fixture.componentInstance.touch.subscribe(touched);
  return { ...page, touched };
}

describe('SuggestInputComponent — поле з підказками', () => {
  it('кожне слово — у назві чи підказці; стрілки й Enter обирають', () => {
    const { s, update, el, touched } = render();
    s.onInput({ target: { value: 'шевч льв' } } as unknown as Event);
    expect(s.matches().map((o) => o.value)).toEqual(['t2']);
    update();
    expect(el.querySelectorAll('[role=option]')).toHaveLength(1);
    s.onInput({ target: { value: 'львів' } } as unknown as Event);
    s.onKeydown(key('ArrowDown'));
    s.onKeydown(key('ArrowDown'));
    s.onKeydown(key('ArrowDown'));
    expect(s.active()).toBe(0);
    s.onKeydown(key('ArrowUp'));
    expect(s.active()).toBe(1);
    s.onKeydown(key('Enter'));
    expect(s.value()).toBe('Галицький РТЦК та СП');
    expect(s.open()).toBe(false);
    expect(touched).toHaveBeenCalled();
    // the exact value is already in the field
    expect(s.matches()).toEqual([]);
  });

  it('Escape і Tab закривають; клік поза полем закриває; без збігів стрілки нічого не роблять', () => {
    const { s, el, fixture } = render();
    s.onFocus();
    expect(s.open()).toBe(true);
    s.onKeydown(key('Escape'));
    expect(s.open()).toBe(false);
    s.onFocus();
    s.onKeydown(key('Tab'));
    expect(s.open()).toBe(false);
    s.onFocus();
    s.onDocumentClick({ target: el } as unknown as MouseEvent);
    expect(s.open()).toBe(true);
    s.onDocumentClick({ target: document.body } as unknown as MouseEvent);
    expect(s.open()).toBe(false);
    s.onInput({ target: { value: 'нічого такого' } } as unknown as Event);
    s.onKeydown(key('ArrowDown'));
    expect(s.active()).toBe(-1);
    fixture.componentInstance.focus();
  });

  it('лише для читання — список не відкривається; обмеження кількості', () => {
    const { s } = render({ readonly: true, limit: 2 });
    s.onFocus();
    expect(s.open()).toBe(false);
    expect(s.matches()).toHaveLength(2);
  });
});

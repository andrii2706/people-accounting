import { TestBed } from '@angular/core/testing';
import { DateInputComponent } from './date-input.component';

function setup(value = '') {
  const fixture = TestBed.createComponent(DateInputComponent);
  fixture.componentRef.setInput('value', value);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector('input') as HTMLInputElement;
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  return { fixture, el, input, type, value: () => fixture.componentInstance.value() };
}

describe('DateInputComponent', () => {
  it('показує ISO як ДД.ММ.РРРР', () => {
    expect(setup('2026-11-02').input.value).toBe('02.11.2026');
  });

  it('при введенні ставить крапки і віддає ISO', () => {
    const t = setup();
    t.type('02112026');
    expect(t.input.value).toBe('02.11.2026');
    expect(t.value()).toBe('2026-11-02');
  });

  it('неіснуючу дату лишає текстом, щоб форма показала помилку', () => {
    const t = setup();
    t.type('31022026');
    expect(t.value()).toBe('31.02.2026');
  });

  it('очищення поля дає порожнє значення', () => {
    const t = setup('2026-11-02');
    t.type('');
    expect(t.value()).toBe('');
  });

  it('календар: вибір дня ставить дату', () => {
    const t = setup('2026-11-02');
    (t.el.querySelector('button') as HTMLButtonElement).click();
    t.fixture.detectChanges();
    const day = [
      ...t.el.querySelectorAll<HTMLButtonElement>('[role="dialog"] button, .grid button'),
    ].find((b) => b.textContent?.trim() === '15');
    expect(day).toBeTruthy();
    day!.click();
    t.fixture.detectChanges();
    expect(t.value()).toBe('2026-11-15');
  });

  it('вимкнене поле не відкриває календар', () => {
    const t = setup();
    t.fixture.componentRef.setInput('disabled', true);
    t.fixture.detectChanges();
    (t.el.querySelector('button') as HTMLButtonElement).click();
    t.fixture.detectChanges();
    expect(t.el.querySelectorAll('.grid button').length).toBe(0);
  });
});

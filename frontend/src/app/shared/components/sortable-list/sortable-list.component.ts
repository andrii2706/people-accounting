import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { SortableItem } from '../../interfaces/label-settings.interface';
import { moveItem } from '../../utils/label-settings.utils';
import { IconComponent } from '../icon/icon.component';

/**
 * A short list sorted by dragging with the mouse (HTML drag and drop, no library); the arrows do the same
 * from the keyboard and on a touch screen, where dragging does not work.
 */
@Component({
  selector: 'app-sortable-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './sortable-list.component.html',
})
export class SortableListComponent {
  /** In the current order. */
  readonly items = input.required<SortableItem[]>();
  readonly ariaLabel = input('');
  /** The values in the new order. */
  readonly reorder = output<string[]>();

  protected readonly dragging = signal<number | null>(null);
  protected readonly over = signal<number | null>(null);

  protected start(event: DragEvent, index: number) {
    this.dragging.set(index);
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected enter(event: DragEvent, index: number) {
    if (this.dragging() === null) return;
    event.preventDefault();
    this.over.set(index);
  }

  protected drop(event: DragEvent, index: number) {
    event.preventDefault();
    const from = this.dragging();
    this.end();
    if (from !== null && from !== index) this.move(from, index);
  }

  protected end() {
    this.dragging.set(null);
    this.over.set(null);
  }

  protected move(from: number, to: number) {
    const values = this.items().map((i) => i.value);
    if (to < 0 || to >= values.length) return;
    this.reorder.emit(moveItem(values, from, to));
  }
}

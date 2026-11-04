import { Pipe, type PipeTransform } from '@angular/core';
import { formatPhone } from '../utils/phone.utils';

/** «+380671234567» → «+380 67 123 45 67» (stored without spaces, shown in groups). */
@Pipe({ name: 'phone' })
export class PhonePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatPhone(value);
  }
}

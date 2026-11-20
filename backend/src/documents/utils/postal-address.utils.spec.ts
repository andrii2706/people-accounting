import { describe, expect, it } from 'vitest';
import { postalAddressLines, postalAddressParts } from './postal-address.utils.js';

describe('postal address — the order of the Rules (cl. 32)', () => {
  it('the street with the house first, the settlement after, the index last', () => {
    expect(postalAddressLines('79007, м. Львів, вул. Батуринська, 2')).toEqual([
      'вул. Батуринська, 2',
      'м. Львів',
      '79007',
    ]);
    expect(postalAddressLines('м. Київ, вул. Велика Васильківська, 104-Б', '03150')).toEqual([
      'вул. Велика Васильківська, 104-Б',
      'м. Київ',
      '03150',
    ]);
  });

  it('a district and a region go after the settlement', () => {
    expect(postalAddressParts('Львівська обл., Золочівський р-н, м. Броди, вул. Залізнична, буд. 3, оф. 12')).toEqual([
      'вул. Залізнична, буд. 3, оф. 12',
      'м. Броди',
      'Золочівський р-н',
      'Львівська обл.',
    ]);
  });

  it('an address it cannot read stays as it is', () => {
    expect(postalAddressParts('Військова частина А0000')).toEqual(['Військова частина А0000']);
    expect(postalAddressLines('', '')).toEqual([]);
  });
});

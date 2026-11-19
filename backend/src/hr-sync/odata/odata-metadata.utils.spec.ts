import { describe, expect, it } from 'vitest';
import { detectProfile, odataBase, odataDate, odataGender, odataRef, parseMetadata } from './odata-metadata.utils.js';

const metadata = (types: Record<string, string[]>) =>
  `<?xml version="1.0"?><edmx:Edmx><edmx:DataServices><Schema>${Object.entries(types)
    .map(
      ([name, props]) =>
        `<EntityType Name="${name}"><Key><PropertyRef Name="Ref_Key"/></Key>${props
          .map((p) => `<Property Name="${p}" Type="Edm.String"/>`)
          .join('')}</EntityType>`,
    )
    .join('')}</Schema></edmx:DataServices></edmx:Edmx>`;

describe('1C OData publication', () => {
  it('recognises ЗУП by its tables and picks the fields it has', () => {
    const schema = parseMetadata(
      metadata({
        Catalog_Сотрудники: ['Ref_Key', 'Code', 'Description', 'ФизическоеЛицо_Key', 'Организация_Key'],
        Catalog_ФизическиеЛица: ['Ref_Key', 'Description', 'ДатаРождения', 'Пол', 'ИНН'],
        Catalog_Организации: ['Ref_Key', 'Description', 'КодПоЕДРПОУ'],
        InformationRegister_ТекущиеКадровыеДанныеСотрудников: ['Сотрудник_Key', 'ДатаПриема', 'ДатаУвольнения'],
      }),
    );
    const p = detectProfile(schema)!;
    expect(p.profile.id).toBe('ZUP_RU');
    expect(p.fields.employeeOrganization).toBe('Организация_Key');
    expect(p.fields.personTaxId).toBe('ИНН');
    expect(p.hasStaff).toBe(true);
    expect(p.hasNames).toBe(false);
    expect(p.missing).toContain('InformationRegister_ФИОФизическихЛиц');
  });

  it('nothing known → null', () => {
    expect(detectProfile(parseMetadata(metadata({ Catalog_Номенклатура: ['Ref_Key'] })))).toBeNull();
  });

  it('builds the standard address and reads 1C values', () => {
    expect(odataBase('https://1c.example.ua/zup/')).toBe('https://1c.example.ua/zup/odata/standard.odata');
    expect(odataBase('https://1c.example.ua/zup/odata/standard.odata/$metadata')).toBe(
      'https://1c.example.ua/zup/odata/standard.odata',
    );
    expect(odataDate('2026-03-12T00:00:00')).toBe('2026-03-12');
    expect(odataDate('0001-01-01T00:00:00')).toBe('');
    expect(odataRef('00000000-0000-0000-0000-000000000000')).toBe('');
    expect(odataGender('Женский')).toBe('F');
    expect(odataGender('Чоловіча')).toBe('M');
  });
});

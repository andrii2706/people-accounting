import type { TestAccount } from '../shared/interfaces/auth.interface.js';
import type { CreateLegalEntityDto } from '../legal-entities/legal-entities.dto.js';

/** Password of every local test account (override: TEST_ACCOUNTS_PASSWORD). */
export const TEST_ACCOUNTS_PASSWORD = 'Test-Oblik-2026';

/** One account per role (fictional people, example.com addresses). The main administrator is ADMIN_EMAIL. */
export const TEST_ACCOUNTS: TestAccount[] = [
  {
    email: 'entity-admin@example.com',
    fullName: 'Тарас АДМІНЮРОСОБИ',
    role: 'ENTITY_ADMIN',
    entity: 'A',
    purpose: 'адмін юрособи А: облік, реквізити, доступи, користувачі А',
  },
  {
    email: 'director@example.com',
    fullName: 'Іван ДИРЕКТОРСЬКИЙ',
    role: 'DIRECTOR',
    entity: 'A',
    purpose: 'директор юрособи А: як адмін юрособи',
  },
  {
    email: 'hr@example.com',
    fullName: 'Ольга ОБЛІКОВА',
    role: 'HR',
    entity: 'A',
    purpose: 'відповідальний за облік юрособи А',
  },
  {
    email: 'hr-b@example.com',
    fullName: 'Марта ІНШОЮРОСОБНА',
    role: 'HR',
    entity: 'B',
    purpose: 'відповідальний юрособи Б — не має бачити нічого з А',
  },
  {
    email: 'director-new@example.com',
    fullName: 'Петро НОВОДИРЕКТОР',
    role: 'DIRECTOR',
    entity: null,
    purpose: 'директор без юрособи: після входу додає свою',
  },
];

/** The second demo legal entity — to check that the data of the legal entities are separated. */
export const DEMO_ENTITY_B: CreateLegalEntityDto = {
  fullName: 'Товариство з обмеженою відповідальністю «Демо Б»',
  nameLocative: 'Товаристві з обмеженою відповідальністю «Демо Б»',
  shortName: 'ТОВ «Демо Б»',
  edrpou: '00000002',
  address: 'м. Київ, вул. Тестова, 2',
  postalCode: '01001',
  headPosition: 'Директор',
  headName: 'Степан ДЕМОНСТРАЦІЙНИЙ',
  responsibleName: 'Марта ІНШОЮРОСОБНА',
  responsiblePosition: 'Інспектор з кадрів',
  responsiblePhone: '+380440000000',
};

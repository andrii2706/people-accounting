/**
 * Initial data:
 *   npm run seed          — Lviv region TCK directory (from sheet EDU_TCK) + placeholder company details
 *   npm run seed -- --demo — additionally fictitious employees for a demo (NOT real people)
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import type { AuthUser } from '../common/auth.js';
import { Tck } from '../dictionaries/tck.entity.js';
import type { CreateEmployeeDto } from '../employees/employees.dto.js';
import { EmployeesService } from '../employees/employees.service.js';
import { OrganizationService } from '../organization/organization.service.js';
import { UsersService } from '../users/users.service.js';

const TCK_LIST = [
  ['Львівський ОТЦК та СП (м. Львів)', '79005, м. Львів, вул. І. Франка, 25', '(032) 260-26-44'],
  ['Галицько-Франківський ОРТЦК та СП (м. Львів)', '79007, м. Львів, вул. Батуринська, 2', '(032) 261-42-45, 261-31-22'],
  ['Личаківсько-Залізничний ОРТЦК та СП (м. Львів)', '79007, м. Львів, вул. Батуринська, 2', '(032) 255-36-23'],
  ['Шевченківський РТЦК та СП (м. Львів)', '79007, м. Львів, вул. Батуринська, 2', '(032) 261-42-45'],
  ['Сихівський РТЦК та СП (м. Львів)', '79045, м. Львів, вул. Стрийська, 105', '(032) 223-07-70'],
  ['Дрогобицький РТЦК та СП (м. Дрогобич)', '82100, м. Дрогобич, вул. Шевченка, 25', '(03244) 2-16-43'],
  ['Золочівський РТЦК та СП (м. Золочів)', '80700, м. Золочів, вул. Січових Стрільців, 22', '(03265) 4-24-72'],
  ['І відділ Золочівського РТЦК та СП (м. Броди)', '80600, м. Броди, вул. 22-го Січня', '(03266) 4-21-70'],
  ['ІІ відділ Золочівського РТЦК та СП (м. Буськ)', '80500, м. Буськ, вул. Грушевського, 1а', '(03264) 3-00-46'],
  ['Львівський РТЦК та СП (м. Жовква)', '80300, м. Жовква, вул. Дорошенка, 9', '(03252) 2-13-73'],
  ['І відділ Львівського РТЦК та СП (м. Городок)', '81500, м. Городок, вул. Львівська, 3', '(03231) 3-00-24'],
  ['ІІ відділ Львівського РТЦК та СП (м. Кам’янка-Бузька)', '80400, м. Кам’янка-Бузька, вул. Шевченка, 57', '(03254) 2-35-02'],
  ['ІІІ відділ Львівського РТЦК та СП (м. Пустомити)', '81100, м. Пустомити, вул. Грушевського, 36', '(03230) 4-13-41'],
  ['ІV відділ Львівського РТЦК та СП (м. Перемишляни)', '81200, м. Перемишляни, вул. Галицька, 26а', '(03263) 2-14-37'],
  ['Самбірський РТЦК та СП (м. Самбір)', '81400, м. Самбір, вул. Мазепи, 17', '(03236) 6-10-04'],
  ['І відділ Самбірського РТЦК та СП (м. Старий Самбір)', '82000, м. Старий Самбір, вул. Коцюбинського, 6', '(03238) 2-32-27'],
  ['ІІ відділ Самбірського РТЦК та СП (м. Турка)', '82501, м. Турка, вул. Січових Стрільців, 9', '(03269) 3-25-04'],
  ['Стрийський РТЦК та СП (м. Стрий)', '82400, м. Стрий, вул. Нижанківського, 6', '(03245) 5-31-23'],
  ['І відділ Стрийського РТЦК та СП (м. Жидачів)', '81700, м. Жидачів, вул. Шашкевича, 17', '(03239) 31-3-31'],
  ['ІІ відділ Стрийського РТЦК та СП (м. Миколаїв)', '81600, м. Миколаїв, пл. Ринок, 16', '(03241) 5-15-75'],
  ['ІІІ відділ Стрийського РТЦК та СП (м. Сколе)', '82600, м. Сколе, вул. Майдан Незалежності, 4', '(03251) 2-12-92'],
  ['Шептицький РТЦК та СП (м. Шептицький)', '80100, м. Шептицький, вул. Шевська, 36', '(03249) 3-90-09'],
  ['І відділ Шептицького РТЦК та СП (м. Сокаль)', '80000, м. Сокаль, вул. Семенюка, 2', '(03257) 7-30-18'],
  ['ІІ відділ Шептицького РТЦК та СП (м. Радехів)', '80200, м. Радехів, вул. Стоянівська, 23', '(03255) 2-13-76'],
  ['Яворівський РТЦК та СП (м. Яворів)', '81000, м. Яворів, вул. Львівська, 2', '(03259) 2-16-78'],
  ['І відділ Яворівського РТЦК та СП (м. Мостиська)', '81300, м. Мостиська, вул. Міцкевича, 13', '(03234) 4-13-43'],
] as const;

/** «Шевченківський РТЦК та СП» → «Шевченківського РТЦК та СП»; «І відділ …» → «І відділу …». */
export function tckGenitive(name: string): string {
  return name
    .replace(/^((?:І|ІІ|ІІІ|ІV)\s+)відділ\s/u, '$1відділу ')
    .replace(/^(\S+?)ий\s/u, '$1ого ');
}

async function seed() {
  const demo = process.argv.includes('--demo');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const tckRepo = app.get<Repository<Tck>>(getRepositoryToken(Tck));
    for (const [name, address, phone] of TCK_LIST) {
      const exists = await tckRepo.existsBy({ name });
      if (!exists) await tckRepo.save(tckRepo.create({ name, address, phone, nameGenitive: tckGenitive(name) }));
    }
    console.log(`ТЦК: ${await tckRepo.count()}`);

    const org = app.get(OrganizationService);
    const current = await org.get();
    if (!current.fullName) {
      await org.update({
        fullName: 'Товариство з обмеженою відповідальністю «Приклад»',
        nameLocative: 'Товаристві з обмеженою відповідальністю «Приклад»',
        shortName: 'ТзОВ «Приклад»',
        edrpou: '00000000',
        address: '79000, м. Львів, вул. Зразкова, 1',
        headPosition: 'Директор',
        headName: 'Іван ПРИКЛАДНИЙ',
      });
    }
    if (!(await org.listHeads()).length) {
      const o = await org.get();
      if (o.headName) await org.createHead({ position: o.headPosition || 'Директор', fullName: o.headName, validFrom: '2000-01-01' });
    }
    if (!(await org.listResponsible()).length) {
      await org.createResponsible({ fullName: 'Ольга ОБЛІКОВА', position: 'Інспектор з кадрів', validFrom: '2024-01-01', phone: '(032) 000-00-00' });
    }

    if (!demo) return;

    const users = app.get(UsersService);
    const admin = await users.ensureAdmin(process.env.ADMIN_EMAIL ?? 'admin@example.com', process.env.ADMIN_PASSWORD ?? 'ChangeMe123!', 'Адміністратор');
    const actor: AuthUser = { id: admin.id, email: admin.email, fullName: admin.fullName, role: 'ADMIN', mustChangePassword: false };
    const tcks = await tckRepo.find();
    const tck = (prefix: string) => tcks.find((t) => t.name.startsWith(prefix))!.id;
    const employees = app.get(EmployeesService);
    if ((await employees.list({ status: 'all' })).total > 0) {
      console.log('Працівники вже є — демо-дані пропущено');
      return;
    }

    // All people below are fictitious; any resemblance is coincidental.
    const people: CreateEmployeeDto[] = [
      {
        personnelNumber: '001', gender: 'M', lastName: 'Демченко', firstName: 'Андрій', middleName: 'Петрович',
        rnokpp: '3200000001', birthDate: '1987-03-14', registeredAddress: 'м. Львів, вул. Зразкова, 10, кв. 5',
        position: 'головний інженер', hireDate: '2021-02-01', hireOrderNumber: '12-к', hireOrderDate: '2021-01-29',
        rankCode: 14, vos: '021101', trainingProfile: 'загальновійськовий', accountingCategory: '1',
        militaryDocuments: [{ type: 'військовий квиток', series: 'АА', number: '000001', issuedAt: '2009-07-01', issuedBy: 'Шевченківський РВК м. Львова' }],
        servedInArmy: true, tckId: tck('Шевченківський'), registryNumber: '0000000001',
        reserved: true, specialAccountingCertificate: '12345', reservationUntil: '2026-11-15',
        educationLevel: 'Повна вища освіта', educationSpecialty: 'Електроенергетика', maritalStatus: 'MARRIED',
        familyMembers: [
          { relation: 'WIFE', lastName: 'Демченко', firstName: 'Олена', middleName: 'Ігорівна', birthDate: '1989-06-02' },
          { relation: 'SON', lastName: 'Демченко', firstName: 'Максим', middleName: 'Андрійович', birthDate: '2014-09-10' },
        ],
        passportType: 'ID_CARD', passportNumber: '000000001', passportIssuedBy: '4610', passportIssuedAt: '2019-05-20',
      },
      {
        personnelNumber: '002', gender: 'M', lastName: 'Ковальчук', firstName: 'Богдан', middleName: 'Іванович',
        rnokpp: '3300000002', birthDate: '1992-11-30', registeredAddress: 'м. Львів, вул. Тестова, 3',
        actualAddress: 'м. Львів, вул. Пробна, 7, кв. 12', position: 'водій', hireDate: '2023-05-15', hireOrderNumber: '44-к',
        hireOrderDate: '2023-05-12', rankCode: 6, vos: '837', accountingCategory: '1', fitness: 'придатний до військової служби',
        fitnessBasis: 'ст. 2 гр. ІІ', militaryDocuments: [{ type: 'військово-обліковий документ в електронній формі', number: '0000000002', generatedDate: '2025-06-12', generatedTime: '10:15' }],
        tckId: tck('Сихівський'), registryNumber: '0000000002', maritalStatus: 'SINGLE',
        educationLevel: 'Повна загальна середня освіта (ПЗСО)',
      },
      {
        personnelNumber: '003', gender: 'M', lastName: 'Гнатюк', firstName: 'Тарас', middleName: 'Миронович',
        birthDate: '1979-04-02', rnokpp: '2900000003', registeredAddress: 'м. Винники, вул. Умовна, 2', position: 'майстер дільниці',
        hireDate: '2018-09-03', rankCode: 2, vos: '100', accountingCategory: '1', reserveTeamNumber: '0127',
        militaryDocuments: [{ type: 'військовий квиток', series: 'НО', number: '000003' }], tckId: tck('Личаківсько'),
        maritalStatus: 'DIVORCED', fitness: 'обмежено придатний до військової служби',
      },
      {
        personnelNumber: '004', gender: 'F', lastName: 'Мельник', firstName: 'Ірина', middleName: 'Василівна',
        birthDate: '1995-08-21', rnokpp: '3400000004', registeredAddress: 'м. Львів, вул. Прикладна, 15', position: 'медична сестра',
        hireDate: '2024-03-01', hireOrderNumber: '19-к', hireOrderDate: '2024-02-28', rankCode: 2, vos: '899',
        militaryDocuments: [{ type: 'військовий квиток', series: 'АБ', number: '000004' }], tckId: tck('Галицько'),
        registryNumber: '0000000004', maritalStatus: 'MARRIED', educationLevel: 'Базова вища освіта', educationSpecialty: 'Медсестринство',
      },
      {
        personnelNumber: '005', gender: 'M', lastName: 'Олійник', firstName: 'Дмитро', middleName: 'Сергійович',
        birthDate: '2007-02-11', rnokpp: '3900000005', registeredAddress: 'м. Львів, вул. Навчальна, 8', position: 'учень слюсаря',
        hireDate: '2026-07-01', hireOrderNumber: '70-к', hireOrderDate: '2026-06-30', rankCode: 0,
        militaryDocuments: [{ type: 'посвідчення про приписку до призовної дільниці', number: '000005' }], tckId: tck('Шевченківський'),
        deferralConscriptionBasis: 'ст. 17 ч. 1 п. 2 ЗУ «Про військовий обов’язок і військову службу»', maritalStatus: 'SINGLE',
      },
      {
        personnelNumber: '006', gender: 'M', lastName: 'Савчук', firstName: 'Роман', middleName: 'Олегович',
        birthDate: '1966-01-09', rnokpp: '2400000006', registeredAddress: 'м. Львів, вул. Ветеранська, 4', position: 'начальник охорони',
        hireDate: '2015-04-01', rankCode: 16, vos: '420100', trainingProfile: 'інженерний', accountingCategory: '2',
        militaryDocuments: [{ type: 'посвідчення особи офіцера', number: '000006' }], tckId: tck('Львівський ОТЦК'), maritalStatus: 'WIDOWED',
      },
      {
        personnelNumber: '007', gender: 'M', lastName: 'Бондар', firstName: 'Віталій', middleName: 'Романович',
        birthDate: '1990-12-12', rnokpp: '3300000007', registeredAddress: 'м. Львів, вул. Склад, 1', position: 'комірник',
        hireDate: '2022-01-10', rankCode: 3, vos: '106', tckId: tck('Сихівський'), militaryDocuments: [{ type: 'військовий квиток', number: '000007' }],
        mobilizedAt: '2025-03-15', mobilizationReleaseOrder: '31-в', maritalStatus: 'MARRIED',
      },
    ];

    const created = [];
    for (const person of people) created.push(await employees.create(person, actor));

    // A dismissal in the current year and an address change — so there is something to notify the TCK about.
    await employees.dismiss(created[2].id, { dismissalDate: '2026-09-30', dismissalOrderNumber: '88-к', dismissalOrderDate: '2026-09-29' }, actor);
    await employees.update(created[1].id, { actualAddress: 'м. Львів, вул. Нова, 21, кв. 3', changeMeta: { effectiveDate: '2026-10-20', basis: 'заява працівника від 20.10.2026' } }, actor);
    console.log(`Демо-працівників: ${created.length}`);
  } finally {
    await app.close();
  }
}

await seed();

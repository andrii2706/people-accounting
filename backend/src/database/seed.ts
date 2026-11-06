/**
 * Initial data:
 *   npm run seed          — TCK directory: Lviv region (from sheet EDU_TCK) + all other regions (tck-ukraine.ts) + placeholder company details
 *   npm run seed -- --demo — additionally fictitious employees for a demo (NOT real people)
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import { Tck } from '../dictionaries/tck.entity.js';
import { ALL_TCK } from './tck-directory.js';
import type { CreateEmployeeDto } from '../employees/employees.dto.js';
import { EmployeesService } from '../employees/employees.service.js';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service.js';
import { UsersService } from '../users/users.service.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';

async function seed() {
  const demo = process.argv.includes('--demo');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const tckRepo = app.get<Repository<Tck>>(getRepositoryToken(Tck));
    // the directory is also filled by the TckDirectory migration; here — in case it was cleared by hand
    let added = 0;
    for (const t of ALL_TCK) {
      if (await tckRepo.existsBy({ name: t.name })) continue;
      await tckRepo.save(tckRepo.create(t));
      added++;
    }
    console.log(`ТЦК: ${await tckRepo.count()} (додано: ${added})`);

    const entities = app.get(LegalEntitiesService);
    if (!(await entities.list()).length) {
      // fictitious demo company — replace with real requisites in «Юридичні особи»
      await entities.create({
        fullName: 'Товариство з обмеженою відповідальністю «Приклад»',
        nameLocative: 'Товаристві з обмеженою відповідальністю «Приклад»',
        shortName: 'ТзОВ «Приклад»',
        edrpou: '00000000',
        address: 'м. Львів, вул. Зразкова, 1',
        postalCode: '79000',
        headPosition: 'Директор',
        headName: 'Іван ПРИКЛАДНИЙ',
        responsibleName: 'Ольга ОБЛІКОВА',
        responsiblePosition: 'Інспектор з кадрів',
        responsiblePhone: '+380320000000',
      });
    }

    if (!demo) return;

    const users = app.get(UsersService);
    const admin = await users.ensureAdmin(
      process.env.ADMIN_EMAIL ?? 'admin@example.com',
      process.env.ADMIN_PASSWORD ?? 'ChangeMe123!',
      'Адміністратор',
    );
    const actor: AuthUser = {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: 'ADMIN',
      legalEntityId: null,
      mustChangePassword: false,
    };
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
        personnelNumber: '001',
        gender: 'M',
        lastName: 'Демченко',
        firstName: 'Андрій',
        middleName: 'Петрович',
        rnokpp: '3200000001',
        birthDate: '1987-03-14',
        registeredAddress: 'м. Львів, вул. Зразкова, 10, кв. 5',
        position: 'головний інженер',
        hireDate: '2021-02-01',
        hireOrderNumber: '12-к',
        hireOrderDate: '2021-01-29',
        rankCode: 14,
        vos: '021101',
        trainingProfile: 'загальновійськовий',
        accountingCategory: '1',
        militaryDocuments: [
          {
            type: 'військовий квиток',
            series: 'АА',
            number: '000001',
            issuedAt: '2009-07-01',
            issuedBy: 'Шевченківський РВК м. Львова',
          },
        ],
        servedInArmy: true,
        tckId: tck('Шевченківський'),
        registryNumber: '0000000001',
        reserved: true,
        specialAccountingCertificate: '12345',
        reservationUntil: '2026-11-15',
        educations: [
          {
            level: 'Повна вища освіта',
            institution: 'Національний університет «Львівська політехніка»',
            specialty: 'Електроенергетика',
            document: 'диплом магістра ЛВ № 000001',
            documentDate: '2010-06-30',
          },
          {
            level: 'Повна вища освіта',
            institution: 'Львівський національний університет імені Івана Франка',
            specialty: 'Менеджмент',
            document: 'диплом магістра ЛВ № 000002',
            documentDate: '2016-06-30',
          },
        ],
        maritalStatus: 'MARRIED',
        familyMembers: [
          {
            relation: 'WIFE',
            lastName: 'Демченко',
            firstName: 'Олена',
            middleName: 'Ігорівна',
            birthDate: '1989-06-02',
          },
          {
            relation: 'SON',
            lastName: 'Демченко',
            firstName: 'Максим',
            middleName: 'Андрійович',
            birthDate: '2014-09-10',
          },
        ],
        passportType: 'ID_CARD',
        passportNumber: '000000001',
        passportIssuedBy: '4610',
        passportIssuedAt: '2019-05-20',
      },
      {
        personnelNumber: '002',
        gender: 'M',
        lastName: 'Ковальчук',
        firstName: 'Богдан',
        middleName: 'Іванович',
        rnokpp: '3300000002',
        birthDate: '1992-11-30',
        registeredAddress: 'м. Львів, вул. Тестова, 3',
        actualAddress: 'м. Львів, вул. Пробна, 7, кв. 12',
        position: 'водій',
        hireDate: '2023-05-15',
        hireOrderNumber: '44-к',
        hireOrderDate: '2023-05-12',
        rankCode: 6,
        vos: '837',
        accountingCategory: '1',
        fitness: 'придатний до військової служби',
        fitnessBasis: 'ст. 2 гр. ІІ',
        militaryDocuments: [
          {
            type: 'військово-обліковий документ в електронній формі',
            number: '0000000002',
            generatedDate: '2025-06-12',
            generatedTime: '10:15',
          },
        ],
        tckId: tck('Сихівський'),
        registryNumber: '0000000002',
        maritalStatus: 'SINGLE',
        educationLevel: 'Повна загальна середня освіта (ПЗСО)',
      },
      {
        personnelNumber: '003',
        gender: 'M',
        lastName: 'Гнатюк',
        firstName: 'Тарас',
        middleName: 'Миронович',
        birthDate: '1979-04-02',
        rnokpp: '2900000003',
        registeredAddress: 'м. Винники, вул. Умовна, 2',
        position: 'майстер дільниці',
        hireDate: '2018-09-03',
        rankCode: 2,
        vos: '100',
        accountingCategory: '1',
        reserveTeamNumber: '0127',
        militaryDocuments: [{ type: 'військовий квиток', series: 'НО', number: '000003' }],
        tckId: tck('Личаківсько'),
        maritalStatus: 'DIVORCED',
        fitness: 'обмежено придатний до військової служби',
      },
      {
        personnelNumber: '004',
        gender: 'F',
        lastName: 'Мельник',
        firstName: 'Ірина',
        middleName: 'Василівна',
        birthDate: '1995-08-21',
        rnokpp: '3400000004',
        registeredAddress: 'м. Львів, вул. Прикладна, 15',
        position: 'медична сестра',
        hireDate: '2024-03-01',
        hireOrderNumber: '19-к',
        hireOrderDate: '2024-02-28',
        rankCode: 2,
        vos: '899',
        militaryDocuments: [{ type: 'військовий квиток', series: 'АБ', number: '000004' }],
        tckId: tck('Галицько'),
        registryNumber: '0000000004',
        maritalStatus: 'MARRIED',
        educationLevel: 'Базова вища освіта',
        educationSpecialty: 'Медсестринство',
      },
      {
        personnelNumber: '005',
        gender: 'M',
        lastName: 'Олійник',
        firstName: 'Дмитро',
        middleName: 'Сергійович',
        birthDate: '2007-02-11',
        rnokpp: '3900000005',
        registeredAddress: 'м. Львів, вул. Навчальна, 8',
        position: 'учень слюсаря',
        hireDate: '2026-07-01',
        hireOrderNumber: '70-к',
        hireOrderDate: '2026-06-30',
        rankCode: 0,
        militaryDocuments: [{ type: 'посвідчення про приписку до призовної дільниці', number: '000005' }],
        tckId: tck('Шевченківський'),
        deferralConscriptionBasis: 'ст. 17 ч. 1 п. 2 ЗУ «Про військовий обов’язок і військову службу»',
        maritalStatus: 'SINGLE',
      },
      {
        personnelNumber: '006',
        gender: 'M',
        lastName: 'Савчук',
        firstName: 'Роман',
        middleName: 'Олегович',
        birthDate: '1966-01-09',
        rnokpp: '2400000006',
        registeredAddress: 'м. Львів, вул. Ветеранська, 4',
        position: 'начальник охорони',
        hireDate: '2015-04-01',
        rankCode: 16,
        vos: '420100',
        trainingProfile: 'інженерний',
        accountingCategory: '2',
        militaryDocuments: [{ type: 'посвідчення особи офіцера', number: '000006' }],
        tckId: tck('Львівський ОТЦК'),
        maritalStatus: 'WIDOWED',
      },
      {
        personnelNumber: '007',
        gender: 'M',
        lastName: 'Бондар',
        firstName: 'Віталій',
        middleName: 'Романович',
        birthDate: '1990-12-12',
        rnokpp: '3300000007',
        registeredAddress: 'м. Львів, вул. Склад, 1',
        position: 'комірник',
        hireDate: '2022-01-10',
        rankCode: 3,
        vos: '106',
        tckId: tck('Сихівський'),
        militaryDocuments: [{ type: 'військовий квиток', number: '000007' }],
        mobilizedAt: '2025-03-15',
        mobilizationReleaseOrder: '31-в',
        maritalStatus: 'MARRIED',
      },
    ];

    const created = [];
    for (const person of people) created.push(await employees.create(person, actor));

    // A dismissal in the current year and an address change — so there is something to notify the TCK about.
    await employees.dismiss(
      created[2].id,
      { dismissalDate: '2026-09-30', dismissalOrderNumber: '88-к', dismissalOrderDate: '2026-09-29' },
      actor,
    );
    await employees.update(
      created[1].id,
      {
        actualAddress: 'м. Львів, вул. Нова, 21, кв. 3',
        changeMeta: { effectiveDate: '2026-10-20', basis: 'заява працівника від 20.10.2026' },
      },
      actor,
    );
    console.log(`Демо-працівників: ${created.length}`);
  } finally {
    await app.close();
  }
}

await seed();

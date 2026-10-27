# Військовий облік — веб-застосунок

Облік призовників, військовозобов’язаних та резервістів на підприємстві (одна компанія).
Замінює робочий файл `new_military_list_v8.6.xlsb`: та сама логіка, але без ручних формул, з історією змін,
журналом вихідних листів і підписом документів для ТЦК кваліфікованим електронним підписом.

| Частина  | Стек |
|----------|------|
| Backend  | NestJS 12 · TypeORM 1.x · PostgreSQL 16 · class-validator · Swagger · `docx` · pkijs (КЕП) |
| Frontend | Angular 22 (standalone, zoneless) · **SSR** · **Tailwind CSS 4** · **Signals** (signal, computed, linkedSignal, Signal Forms) · lazy-модулі + резолвери |
| Хостинг  | Firebase App Hosting (SSR) · Cloud Run (API, приватний) · Cloud SQL · Secret Manager · Cloud Storage — [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

📄 Документація: [Розгортання (налаштування)](docs/DEPLOYMENT.md) · [Процес деплою](docs/DEPLOYMENT-PROCESS.md) · [Безпека](docs/SECURITY.md) · [Підпис КЕП](docs/KEP.md)

---

## Швидкий старт

### Docker (найпростіше)
```bash
docker compose up --build
# http://localhost:4000  →  admin@example.com / ChangeMe123!
```

### Локальна розробка
```bash
# 1. PostgreSQL, база "military":  docker compose up db   (або власний Postgres)

# 2. Backend
cd backend
cp .env.example .env            # за потреби змініть DATABASE_URL, JWT_SECRET
npm install --legacy-peer-deps
npm run seed -- --demo          # міграції + довідник ТЦК + вигадані демо-працівники
npm run start:dev               # http://localhost:3000/api, Swagger: /api/docs

# 3. Frontend
cd ../frontend
npm install
npm start                       # http://localhost:4200 (SSR + проксі /api → :3000)
```

Вхід: `ADMIN_EMAIL` / `ADMIN_PASSWORD` з `.env` (адміністратор створюється під час старту API).

---

## Як логіка Excel перенесена в застосунок

| У файлі Excel | У застосунку |
|---|---|
| Аркуші `01`…`21` — картка працівника з історією документів | Сутність `Employee` + `FamilyMember`; історія — `employee_changes` і `audit_log` |
| Колонки `FD…FK`, `GH` — категорія (військовозобов’язаний / резервіст / призовник) | `military/military-logic.ts → dutyCategory()` |
| Аркуші `G1, G1R … G4R` — групи списків | `listGroup()` — 8 груп за статтю, складом і службою в резерві |
| «Звільнені залишаються у списках до кінця року» (`Date!C2 < DATE(YEAR(Z2)+1,1,1)`) | `isOnListsAt()` |
| Колонки `GP/GQ/GR` + аркуш `OCL` — Відомість оперативного обліку (Дод. 12) | `ReportsService.operational()` |
| `EDU_TCK` — звання армії/флоту, граничний вік, освіта, сімейний стан, ТЦК Львівщини | `military/ranks.ts`, `military/dictionaries.ts`, таблиця `tck` (сід) |
| Рядки 102–114 картки — 12 типів змін для ТЦК | `CHANGE_RULES` в `employees.service.ts` — фіксуються **автоматично** при редагуванні |
| Повідомлення (Дод. 4), супровідний лист, опис ф.107 | `documents/builders.ts → buildChangeNotice()` — один лист може містити повідомлення по кількох працівниках (групування за ТЦК); кожне повідомлення зберігається в БД (`change_notices`, знімок даних зашифровано) |
| Аркуші `GN1 … GN4R` — списки персонального обліку (Дод. 5 у ред. постанови КМУ № 916 зі змінами № 812 від 10.06.2026), витяг | `buildLists()` — окремий список на кожну групу, один рядок на особу (графи 1–18), альбомна орієнтація; логіка граф — `military/personal-list.ts` |
| Наклейки на конверт (аркуш `03`, рядки 100–106) | `buildEnvelopeLabels()` — «Відправник / Отримувач» з індексом і телефоном, кілька на аркуш A4 |
| Аркуш `G` (реквізити) і `Authorized` (відповідальні за періодами) | `organization`, `responsible_persons` — підставляється особа, чий період охоплює дату документа |
| Відмінювання ПІБ (рядки 223+) | бібліотека `shevchenko` (родовий відмінок у супровідному листі) |

Чисті функції домену покриті тестами: `backend/src/military/military-logic.spec.ts` (`npm test`).

### Чого не було в Excel, але з’явилось
- **Попередження**: граничний вік, бронювання/відстрочка спливають (за N днів, налаштовується), немає ТЦК/ВОД/номера ЄДР.
- **Черга повідомлень ТЦК** зі строком (за замовчуванням 7 днів) і позначкою «прострочено».
- **Журнал вихідних** з автонумерацією за рік (`pg_advisory_xact_lock` — без дублів номерів).
- **Передача в ТЦК** — поза системою (Укрпошта, нарочно, СЕД, електронний кабінет): застосунок формує документ
  або пакет «документ + .p7s», а лист позначається як переданий. Автоматичної відправки email немає свідомо.
- **Підпис КЕП** будь-якого надавача: віджет ІІТ на сторінці або файл `.p7s` з Дії/ЦЗО/будь-якої програми;
  сервер перевіряє, що підпис саме під цей документ, і формує пакет «документ + .p7s» для ТЦК ([docs/KEP.md](docs/KEP.md)).
- **Журнал дій** (вхід, перегляд картки, зміни, експорт, відправка, підпис) — вимога для роботи з персональними даними.
- Ролі `ADMIN` / `HR`, керування користувачами, тимчасові паролі з примусовою зміною.

---

## Архітектура

```
backend/src
├── military/          ← доменна логіка (без БД): звання, категорії, групи, попередження, форматування текстів
├── employees/         ← картки, відстеження змін, звільнення, аудит переглядів
├── letters/           ← журнал вихідних, формування повідомлень, позначка «передано в ТЦК»
├── signatures/        ← КЕП: фіксація документа, розбір і перевірка CMS (.p7s), пакет для ТЦК
├── storage/           ← файлове сховище write-once (локально / Cloud Storage)
├── reports/           ← списки (Дод. 5), відомість (Дод. 12), дашборд
├── documents/         ← генерація DOCX (docx-kit + builders)
├── audit/             ← журнал дій з маскуванням чутливих полів
├── common/crypto/     ← AES-256-GCM для полів, HMAC-індекс РНОКПП
├── auth/ users/       ← сесії в httpOnly cookie, блокування, політика паролів
├── organization/ dictionaries/ mail/ config/
└── database/          ← data-source, міграції, сід, migrate.ts (Cloud Run Job)

frontend/src/app
├── app.routes.ts      ← лише каркас + loadChildren на кожен розділ
├── layout/shell/      ← бічне меню, індикатор навігації
├── pages/             ← сторінки; кожен розділ — lazy-модуль зі своїм *.routes.ts і резолверами
│   ├── auth/ dashboard/ profile/
│   ├── employees/     ← employee-list · employee-detail · employee-form · resolvers/
│   ├── letters/       ← letter-list · letter-detail · letter-signing · resolvers/
│   ├── notifications/ reports/ settings/
└── shared/            ← components · interfaces · services · guards · interceptors · pipes · resolvers · utils · validators · tokens · constants
```

### Frontend: Angular-патерни
- **Lazy loading** — кожен розділ (`employees`, `letters`, …) завантажується окремим чанком через `loadChildren`.
- **Резолвери** — дані сторінки завантажуються до її відкриття; незалежні запити (лист + стан підписання +
  налаштування КЕП) виконуються паралельно. Фільтри списків — у query params (`runGuardsAndResolvers`),
  оновлення після збереження — повторний запуск резолверів.
- **Стан** — `signal` / `computed` / `linkedSignal`; дані з резолвера приходять у компонент через `input()`
  (`withComponentInputBinding`). Фонові дані, що не блокують сторінку (лічильник змін для ТЦК, історія картки), —
  `httpResource()`.
- **Форми** — **Signal Forms** (`form`, `[formField]`, `required/validate/applyEach`, `submit()`);
  ті самі правила валідації, що й на бекенді (`shared/validators/employee-rules.ts` ≡ `backend/src/military/employee-rules.ts`);
  при помилці форма відкриває вкладку з полем і фокусує його.
- Іменування за Angular style guide: `*.component.ts`, `*.service.ts`, `*.resolver.ts`, `*.guard.ts`, `*.interceptor.ts`, `*.pipe.ts`.
- Zoneless, `OnPush` скрізь.

### SSR та безпека
- Сесія лише в **httpOnly cookie** (`__Host-mr_session` у продакшні) — JavaScript її не бачить.
- Під час SSR `SsrApiBackend` (HttpBackend лише для сервера) спрямовує `/api` на внутрішню адресу і пересилає
  cookie вхідного запиту, тож сторінка рендериться вже з даними користувача, а кеш передачі стану
  (HTTP transfer cache) не дає браузеру повторювати ті самі GET-запити після гідратації.
- Express-сервер Angular проксіює `/api` на NestJS — один origin, без CORS. У продакшні додає IAM-токен
  (API на Cloud Run закритий для інтернету).
- CSP з хешами інлайн-скриптів, HSTS, `frame-ancestors 'none'`, `no-store` для сторінок з персональними даними.
- Повний опис — [docs/SECURITY.md](docs/SECURITY.md).

---

## Змінні середовища

**backend** — повний перелік з поясненнями в [`backend/.env.example`](backend/.env.example)
(БД, сесії, ключі шифрування, сховище, КЕП, перший адміністратор).

**frontend (SSR-сервер)**:

| Змінна | За замовчуванням | Призначення |
|---|---|---|
| `PORT` | 4000 | порт SSR (App Hosting задає 8080) |
| `API_INTERNAL_URL` | http://localhost:3000 | адреса NestJS API |
| `API_AUTH` | — | `google-id-token` — додавати IAM-токен (Cloud Run) |
| `SSR_API_BASE` | = `API_INTERNAL_URL` | куди SSR робить запити (у продакшні — власний проксі `http://127.0.0.1:8080`) |
| `NG_ALLOWED_HOSTS` | localhost | дозволені хости SSR |
| `TRUST_PROXY_HOPS` | 1 | кількість проксі перед сервером |
| `CSP_FRAME_SRC` | https://eu.iit.com.ua | дозволені фрейми (віджет КЕП) |
| `ALLOWED_CLIENT_CIDRS` | — | доступ лише з цих мереж (офіс/VPN) |

## Міграції
```bash
cd backend
npm run migration:generate -- src/database/migrations/AddSomething   # після зміни сутностей
# додати клас у src/database/migrations/index.ts
npm run migration:run
```

---

## Наступні кроки (ідеї)
- Імпорт наявних даних з `.xlsb` (аркуш «список» та картки 01–21) — одноразовий скрипт.
- PDF поряд із DOCX (LibreOffice headless у контейнері) — для підпису PAdES.
- Нагадування про прострочені повідомлення / завершення бронювання (на дашборді вже є; за потреби — сповіщення).
- 2FA (TOTP) для адміністраторів; вхід через Google Workspace / Entra ID (SSO).
- Повна перевірка підписів ДСТУ 4145 на сервері (бібліотека ІІТ для Node.js) і ланцюжка до ЦЗО.

> ⚠️ Демо-дані (`npm run seed -- --demo`) — вигадані люди. Не завантажуйте реальні персональні дані в тестові середовища.

# Розгортання: Firebase App Hosting + Cloud Run + Cloud SQL

> Це одноразове налаштування інфраструктури. Щоденний процес випуску змін, правила міграцій і відкат —
> у [DEPLOYMENT-PROCESS.md](DEPLOYMENT-PROCESS.md).

```
 Браузер ──HTTPS──▶ Firebase App Hosting (Angular SSR, Express)          europe-west4
                      │  /api/*  → проксі + ID-токен сервісного акаунта
                      ▼
                    Cloud Run «military-registry-api» (NestJS)        ← без публічного доступу (IAM)
                      │  Cloud SQL connector (IAM + TLS)      │  Secret Manager
                      ▼                                       ▼
                    Cloud SQL PostgreSQL 16              Cloud Storage (підписані документи,
                    (бекапи, PITR, шифрування)           retention / write-once)
```

* **Фронтенд** — Firebase App Hosting (керований Cloud Run для SSR-фреймворків). Збирається з гілки `main`
  автоматично, конфігурація — `frontend/apphosting.yaml`, `firebase.json`.
* **API** — окремий Cloud Run, викликати його може **лише** сервісний акаунт App Hosting
  (`roles/run.invoker`). Браузер не має прямого доступу до API: усі запити йдуть через `/api` на тому ж домені.
* **БД** — Cloud SQL без authorized networks: підключення тільки через Cloud SQL connector.
* **Секрети** — Secret Manager (регіональні, лише `europe-west4`), у коді та в GitHub їх немає.
* **CI/CD** — GitHub Actions з Workload Identity Federation (без JSON-ключів), обов'язкове підтвердження
  деплою через GitHub Environment `production`.

> Чому не класичний Firebase Hosting + Functions: Hosting пропускає до бекенду лише cookie `__session`,
> а API в Functions не дає приватності на рівні IAM так просто, як Cloud Run. App Hosting — офіційний шлях
> для Angular SSR у Firebase.

Регіон `europe-west4` (Нідерланди, ЄС) — App Hosting, Cloud Run і Cloud SQL в одному регіоні, щоб SSR → API → БД
не ходили між регіонами. Передача персональних даних у країни ЄС відповідає вимогам ЗУ «Про захист персональних
даних» (держави — учасниці Конвенції 108), але погодьте це з відповідальним за захист даних у компанії.

---

## 1. Передумови

* Проєкт Google Cloud з тарифом **Blaze**, ви — Owner.
* `gcloud` (≥ 500), `firebase-tools` (≥ 14), `openssl`.
* Репозиторій на GitHub (код з кореня цього архіву).

## 2. Інфраструктура — один скрипт

```bash
PROJECT_ID=my-company-military \
GITHUB_REPO=my-org/military-registry \
APP_DOMAIN=oblik.company.ua \
./infra/bootstrap.sh
```

Скрипт ідемпотентний і створює:

| Ресурс | Налаштування безпеки |
|---|---|
| Cloud SQL `military-registry-db` | `ENCRYPTED_ONLY` TLS, без authorized networks, бекапи 30 днів, PITR 7 днів, deletion protection |
| Секрети `DATABASE_URL`, `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `BLIND_INDEX_KEY`, `ADMIN_PASSWORD`, `SMTP_PASS` | генеруються випадково, регіональна реплікація, доступ лише в API-акаунта |
| Бакет `<project>-mr-signed-docs` | без публічного доступу, uniform access, retention 5 років |
| SA `mr-api` (runtime API) | `cloudsql.client`, читання конкретних секретів, у бакеті — лише створення й читання (без видалення) |
| SA `mr-github-deployer` | `run.admin`, запис в Artifact Registry, `actAs` лише на `mr-api` |
| Workload Identity Federation | токен лише для цього репозиторію, гілки `main` і environment `production` |

Наприкінці скрипт надрукує тимчасовий пароль адміністратора (його попросять змінити при першому вході)
і значення змінних для GitHub.

## 3. GitHub

1. **Settings → Environments → New environment `production`**: увімкніть *Required reviewers*
   і *Deployment branches: main*.
2. **Settings → Secrets and variables → Actions → Variables** — значення з виводу скрипта:
   `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `GCP_API_SA`, `GCP_SQL_INSTANCE`,
   `GCP_BUCKET`, `GCP_WEB_SA`, `APP_ORIGIN`, `ADMIN_EMAIL`.
   Необов'язково: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_FROM`,
   `SIGN_WIDGET_SCRIPT_URL`, `SIGN_WIDGET_FRAME_URL` (див. [KEP.md](KEP.md)).
3. **Settings → Branches**: захист `main` (PR + зелений CI).

Workflows:

| Файл | Коли | Що робить |
|---|---|---|
| `.github/workflows/ci.yml` | PR і push | lint, тести, збірка, міграції up→down→up на чистій БД, `npm audit`, збірка Docker |
| `.github/workflows/deploy-api.yml` | push у `main` (зміни в `backend/`) або вручну | образ → Artifact Registry → **міграції (Cloud Run Job)** → деплой API (`--no-allow-unauthenticated`) → `run.invoker` для App Hosting → перевірка, що немає `allUsers` |
| `.github/dependabot.yml` | щотижня | оновлення залежностей |

## 4. Перший деплой API

Запустіть **Actions → Deploy API → Run workflow**. Після підтвердження у `production` у логах буде URL API
(`https://military-registry-api-….europe-west4.run.app`). Відкрити його в браузері не вийде — 403, так і має бути.

## 5. Фронтенд — Firebase App Hosting

```bash
firebase projects:addfirebase $PROJECT_ID          # якщо проєкт ще не Firebase
firebase apphosting:backends:create \
  --project $PROJECT_ID --location europe-west4 --backend military-registry-web
#   → підключіть GitHub-репозиторій, root directory: frontend, live branch: main
```

Заповніть у `frontend/apphosting.yaml`:

* `API_INTERNAL_URL` — URL API з кроку 4;
* `NG_ALLOWED_HOSTS` — `military-registry-web--<project>.europe-west4.hosted.app` і ваш домен;
* за потреби `ALLOWED_CLIENT_CIDRS` — доступ лише з офісу/VPN.

Push у `main` → App Hosting збере й розгорне SSR. Власний домен: Firebase Console → App Hosting →
*Custom domains* (TLS-сертифікат видається автоматично), потім додайте домен у `NG_ALLOWED_HOSTS`
і в змінну GitHub `APP_ORIGIN`.

## 6. Після першого входу

1. Увійдіть як `ADMIN_EMAIL` з тимчасовим паролем → система попросить змінити пароль.
2. *Налаштування → Організація*: реквізити, відповідальні особи, ТЦК.
3. *Налаштування → Користувачі*: створіть облікові записи працівників кадрів (кожен отримає тимчасовий пароль).
4. SMTP: `gcloud secrets versions add SMTP_PASS --data-file=-` + змінні `SMTP_*` у GitHub → перезапустіть Deploy API.

## 7. Експлуатація

| Задача | Як |
|---|---|
| Оновлення | merge у `main` → CI → Deploy API (з підтвердженням) + App Hosting rollout |
| Відкат API | Cloud Run → Revisions → *Manage traffic* на попередню ревізію (міграції пишіть зворотно сумісними) |
| Відкат фронтенду | Firebase Console → App Hosting → Rollouts → *Roll back* |
| Відновлення БД | Cloud SQL → Backups / Point-in-time recovery (у нову інстанцію, потім перемкнути `DATABASE_URL`) |
| Ротація `JWT_SECRET` | нова версія секрету → новий деплой API → усі сесії завершаться |
| Ротація ключа шифрування | не простою заміною: потрібна міграція перешифрування (стара + нова версія ключа) |
| Журнали | Cloud Logging; журнал дій користувачів — таблиця `audit_log` (вхід, перегляд картки, експорт, підпис) |

### Вартість (орієнтовно)
Cloud SQL `db-custom-1-3840` — основна стаття (~50–60 $/міс). Cloud Run і App Hosting з `minInstances: 0`
для одного відділу кадрів — у межах безкоштовних квот або кілька доларів. Для економії на тестовому
середовищі можна взяти `SQL_TIER=db-f1-micro` (без SLA).

### Локальна перевірка продакшн-збірки
```bash
docker compose up --build        # http://localhost:4000
```

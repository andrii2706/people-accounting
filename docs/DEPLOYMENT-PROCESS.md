# Процес деплою: від коміту до продакшну

Цей документ — про **щоденний** процес випуску змін: як зміна потрапляє в продакшн, хто і що підтверджує,
як писати міграції, як відкотитись і що робити, коли щось пішло не так.

Одноразове налаштування інфраструктури (Cloud SQL, секрети, сервісні акаунти, App Hosting) — у
[DEPLOYMENT.md](DEPLOYMENT.md). Його виконують один раз перед першим релізом.

---

## 1. Середовища

| Середовище | Де працює | Як оновлюється | Дані |
|---|---|---|---|
| **Локальне** | ваш комп'ютер (`npm run start:dev` / `npm start`) або `docker compose up` | вручну | лише демо (`npm run seed -- --demo`) |
| **Production** | Firebase App Hosting (фронтенд) + Cloud Run (API) + Cloud SQL | автоматично з гілки `main` | **реальні персональні дані** |
| Staging (необов'язково) | окремий GCP-проєкт, див. [розділ 9](#9-staging-необовязково) | з гілки `develop` | лише демо |

> ⚠️ Реальні дані працівників існують **тільки** в production. Ні локально, ні на staging їх не завантажують,
> дамп продакшн-бази на комп'ютер розробника не копіюють.

---

## 2. Як зміна потрапляє в продакшн

```
  feature-гілка ──PR──▶ CI (ci.yml) ──рев'ю──▶ merge у main
                                                   │
                     ┌─────────────────────────────┴──────────────────────────────┐
                     ▼                                                            ▼
        Deploy API (deploy-api.yml)                             Firebase App Hosting
        лише якщо змінено backend/**                            (фронтенд, автоматично)
                     │                                                            │
        ⏸ підтвердження в environment «production»                                │
                     │                                                            │
        1. збірка Docker-образу → Artifact Registry                 збірка Angular SSR
        2. міграції БД (Cloud Run Job), чекаємо завершення          (npm run build)
        3. нова ревізія API, 100 % трафіку                                        │
        4. run.invoker для фронтенду + перевірка, що немає allUsers        нова ревізія, rollout
```

### Крок за кроком

1. **Гілка.** Від `main`: `feature/<коротко>` або `fix/<коротко>`. Прямі коміти в `main` заборонені правилами гілки.
2. **Локальна перевірка** перед push:
   ```bash
   cd backend  && npm run lint && npm test && npm run build
   cd frontend && npx prettier --check "src/**/*.{ts,html,css}" && npm run build
   ```
   Якщо змінювали сутності — згенеруйте міграцію (розділ 4).
3. **Pull Request у `main`.** Автоматично запускається **CI** (`.github/workflows/ci.yml`):

   | Job | Що перевіряє |
   |---|---|
   | Backend | lint (oxlint), тести (vitest), збірка, міграції на чистій БД **up → down → up**, `npm audit` |
   | Frontend | форматування (prettier), продакшн-збірка з SSR, `npm audit` |
   | Docker | що образ API збирається |

   PR не можна злити, поки CI не зелений.
4. **Рев'ю.** Мінімум один рецензент. Окремо дивимось на: міграції (розділ 4), зміни прав доступу/ролей,
   будь-що, що логує або повертає персональні дані.
5. **Merge у `main`.** Після цього паралельно стартують два процеси:
   * **Deploy API** — лише якщо в коміті є зміни в `backend/**`. Зупиняється на кроці підтвердження.
   * **App Hosting** — збирає і розгортає фронтенд автоматично (якщо не вимкнено автоматичні rollouts, розділ 3).
6. **Підтвердження деплою API.** GitHub → Actions → Deploy API → *Review deployments* → `production` → *Approve*.
   Підтверджує людина зі списку reviewers environment-у (не автор змін, якщо команда дозволяє).
7. **Деплой API** виконується послідовно:
   1. образ `api:<sha коміту>` → Artifact Registry;
   2. **міграції** — Cloud Run Job `military-registry-migrate` з тим самим образом. Якщо міграція впала —
      деплой зупиняється, **стара версія API продовжує працювати**;
   3. нова ревізія Cloud Run отримує 100 % трафіку;
   4. фронтенду видається право викликати API; якщо раптом з'явився публічний доступ (`allUsers`) — workflow падає.
8. **Перевірка після релізу** (розділ 6).

---

## 3. Порядок фронтенд ↔ API

Фронтенд (App Hosting) розгортається одразу після merge, а API — лише після підтвердження. Отже, кілька хвилин
(або довше, якщо ніхто не підтвердив) **новий фронтенд може працювати зі старим API**.

Є два способи з цим жити — оберіть один і зафіксуйте в команді:

**А. Зворотна сумісність (за замовчуванням).** Кожна зміна API така, що старий фронтенд працює з новим API,
а новий фронтенд — зі старим:
* нові поля у відповіді — можна; видаляти/перейменовувати поля — лише окремим релізом після того,
  як фронтенд перестав їх використовувати;
* нові обов'язкові поля в запитах — ні; спершу необов'язкові з дефолтом;
* новий ендпоінт — спершу API (окремий PR), потім фронтенд, що його викликає.

**Б. Керований порядок.** Вимкнути автоматичні rollouts: Firebase Console → App Hosting →
`people-accounting` → Settings → Deployment → *Automatic rollouts: off*. Тоді після успішного Deploy API:
```bash
firebase apphosting:rollouts:create people-accounting --git-branch main --project <PROJECT_ID>
```

---

## 4. Міграції бази даних

Міграції запускаються **до** того, як нова версія API отримує трафік. У цей момент **стара версія ще працює**
з уже зміненою схемою. Тому кожна міграція має бути сумісною зі старим кодом.

### Як створити
```bash
cd backend
npm run migration:generate -- src/database/migrations/AddSomething
# 1) перегляньте згенерований SQL — TypeORM інколи робить DROP + ADD замість ALTER (втрата даних!)
# 2) зареєструйте клас у src/database/migrations/index.ts
npm run migration:run && npm run migration:revert && npm run migration:run   # перевірка down
```

### Правила (expand → contract)

| Зміна | Як робити безпечно |
|---|---|
| Нова колонка | `NULL` або з `DEFAULT` — одним релізом |
| Нова обов'язкова колонка | реліз 1: nullable + код заповнює; реліз 2: дозаповнити старі рядки + `NOT NULL` |
| Перейменування колонки | реліз 1: нова колонка + запис в обидві; реліз 2: читання з нової; реліз 3: видалення старої |
| Видалення колонки/таблиці | лише коли поточний код їх уже не використовує (окремий реліз) |
| Зміна типу | через нову колонку, як перейменування |
| Шифровані поля (`rnokpp`, паспорт тощо) | міграції даних — лише через `encryptField`/`decryptField`; ключі в Job доступні |
| Індекс на великій таблиці | `CREATE INDEX CONCURRENTLY` (і `transaction = false` у класі міграції) |

Також:
* кожна міграція має робочий `down()` — CI перевіряє up → down → up;
* **не редагуйте** вже застосовану в продакшні міграцію — лише нова міграція;
* таблиця `letter_signatures` захищена тригером від `UPDATE/DELETE` — не обходьте його в міграціях.

---

## 5. Конфігурація і секрети

| Що змінюємо | Де | Як застосувати |
|---|---|---|
| Змінні API (`APP_ORIGIN`, `ADMIN_EMAIL`, віджет КЕП…) | GitHub → Settings → Variables | Actions → Deploy API → *Run workflow* (повторний деплой) |
| Секрети API (`JWT_SECRET`, `ADMIN_PASSWORD`…) | Secret Manager: `printf '%s' 'нове' \| gcloud secrets versions add JWT_SECRET --data-file=-` | повторний деплой API (`:latest` читається під час старту ревізії) |
| Змінні фронтенду (`API_INTERNAL_URL`, хости, `ALLOWED_CLIENT_CIDRS`) | `frontend/apphosting.yaml` | PR → merge (App Hosting перезбирає) |

Особливі випадки:
* **`JWT_SECRET`** — після зміни всі користувачі вийдуть із системи (це очікувано).
* **`DATA_ENCRYPTION_KEY` / `BLIND_INDEX_KEY` — не змінювати простою заміною.** Інакше вже зашифровані дані
  стануть нечитабельними. Ротація — лише спеціальною міграцією перешифрування (стара + нова версія ключа).
  Старі версії секретів не вимикати й не знищувати.

---

## 6. Перевірка після релізу

Хвилин 5 після деплою:

- [ ] Сторінка входу відкривається, вхід працює.
- [ ] Список працівників і картка працівника відкриваються (перевірка розшифрування даних).
- [ ] Формується будь-який документ `.docx` (наприклад, відомість на сьогодні).
- [ ] Якщо змінювалось підписання — сторінка листа з панеллю «Підпис КЕП» відкривається.
- [ ] Cloud Run → `military-registry-api` → Logs: немає нових помилок `ERROR`.
- [ ] Прямий запит до URL API без токена → **403** (API не публічний).

Корисні команди:
```bash
gcloud run services describe military-registry-api --region europe-west4 --format='value(status.latestReadyRevisionName)'
gcloud run jobs executions list --job military-registry-migrate --region europe-west4 --limit 3
gcloud logging read 'resource.labels.service_name="military-registry-api" severity>=ERROR' --limit 20 --freshness 1h
```

---

## 7. Відкат

### API — за хвилину, без перезбирання
```bash
gcloud run revisions list --service military-registry-api --region europe-west4 --limit 5
gcloud run services update-traffic military-registry-api --region europe-west4 \
  --to-revisions military-registry-api-<попередня>=100
```
Або в консолі: Cloud Run → сервіс → *Revisions* → *Manage traffic*.

Наступний merge у `main` знову переведе трафік на нову ревізію. Тому після відкату виправлення роблять через PR
(revert-коміт або фікс).

### Міграції
Автоматично **не відкочуються**. Якщо дотримано правил з розділу 4, стара версія API працює з новою схемою.
Тож зазвичай досить відкотити лише API. Ручний відкат схеми — крайній випадок:
```bash
# локально, з доступом до продакшн-БД через Cloud SQL Auth Proxy і продакшн-секретами
npm run migration:revert
```
Перед цим — бекап на вимогу: `gcloud sql backups create --instance military-registry-db`.

### Фронтенд
Firebase Console → App Hosting → `people-accounting` → *Rollouts* → попередній → *Roll back*.

### Дані (найгірший випадок)
Cloud SQL → *Point-in-time recovery* відновлює дані **в нову інстанцію** на момент до інциденту (до 7 днів).
Потім потрібно оновити секрет `DATABASE_URL` і передеплоїти API. Підписані документи в Cloud Storage не
постраждають: вони write-once.

---

## 8. Термінові виправлення (hotfix)

1. Гілка `fix/...` від `main`, мінімальна зміна.
2. PR → CI. Рев'ю може бути швидким, але обов'язковим.
3. Merge → Deploy API → підтвердження.
4. Якщо проблема критична, а фікс ще не готовий, — спершу **відкат** (розділ 7), потім спокійно фікс.

---

## 9. Staging (необов'язково)

Для перевірки великих змін на інфраструктурі, ідентичній продакшну:

1. Окремий GCP-проєкт: `PROJECT_ID=<назва>-staging SQL_TIER=db-f1-micro ./infra/bootstrap.sh`.
2. Окремий App Hosting backend з live branch `develop`.
3. У GitHub — environment `staging` і копія `deploy-api.yml` з тригером на `develop` та змінними `STAGING_*`.
4. Дані — лише демо: `npm run seed -- --demo`.

Тоді процес такий: `feature → develop` (staging) → перевірка → `develop → main` (production).

---

## 10. Якщо щось пішло не так

| Симптом | Імовірна причина | Що робити |
|---|---|---|
| Deploy API впав на «Міграції БД» | помилка в міграції | `gcloud run jobs executions list …` → Logs. Стара версія API працює далі. Фікс міграції → новий PR |
| API не стартує, у логах «Конфігурація некоректна» | бракує змінної/секрету | у логах перелік, чого саме бракує → додайте у Variables / Secret Manager → повторний деплой |
| Після входу все падає з 403 | фронтенд не має `run.invoker` або `API_AUTH` не `google-id-token` | перезапустіть Deploy API (видає право) і перевірте `apphosting.yaml` |
| Сайт віддає 400 «Header host … is not allowed» | домену немає в `NG_ALLOWED_HOSTS` | додайте домен у `frontend/apphosting.yaml` |
| 502 «Сервіс тимчасово недоступний» | SSR не отримав IAM-токен або неправильний `API_INTERNAL_URL` | логи App Hosting; перевірте URL API |
| Усіх користувачів «викидає» | змінено `JWT_SECRET` або час сесії | очікувано після ротації; інакше — логи API |
| Не розшифровуються дані працівників | змінено `DATA_ENCRYPTION_KEY` | **негайно** поверніть попередню версію секрету й передеплойте |
| Workflow: «API доступний публічно (allUsers)» | хтось вручну відкрив доступ | `gcloud run services remove-iam-policy-binding military-registry-api --member=allUsers --role=roles/run.invoker --region europe-west4` і з'ясуйте, хто це зробив (Cloud Audit Logs) |

---

## Хто що робить

| Роль | Відповідальність |
|---|---|
| Розробник | гілка, міграції за правилами, PR, перевірка після релізу |
| Рецензент | рев'ю коду й міграцій |
| Відповідальний за реліз (reviewer у `production`) | підтвердження деплою API, рішення про відкат |
| Адміністратор GCP | секрети, ротація ключів, доступи, відновлення БД |

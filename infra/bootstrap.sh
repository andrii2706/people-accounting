#!/usr/bin/env bash
# =============================================================================
# One-time Google Cloud / Firebase setup for the military registration app.
#
# Creates: Cloud SQL (PostgreSQL 16), secrets, a bucket for signed documents,
# Artifact Registry, least-privilege service accounts, Workload Identity
# Federation for GitHub Actions (no JSON keys).
#
# Run (as project Owner, gcloud ≥ 500):
#   PROJECT_ID=my-project GITHUB_REPO=org/military-registry APP_DOMAIN=oblik.company.ua ./infra/bootstrap.sh
#
# The script is idempotent: re-running it does not break what exists (secrets are never overwritten).
# Next — the steps in docs/DEPLOYMENT.md (App Hosting, GitHub variables, first deploy).
# =============================================================================
set -euo pipefail

: "${PROJECT_ID:?Вкажіть PROJECT_ID}"
: "${GITHUB_REPO:?Вкажіть GITHUB_REPO у форматі owner/repo}"
REGION="${REGION:-europe-west4}"           # App Hosting, Cloud Run and Cloud SQL in one region (EU)
APP_DOMAIN="${APP_DOMAIN:-}"                # custom frontend domain (optional)
SQL_INSTANCE="${SQL_INSTANCE:-military-registry-db}"
SQL_TIER="${SQL_TIER:-db-custom-1-3840}"
DB_NAME="military"
DB_USER="api"
AR_REPO="military-registry"
API_SERVICE="military-registry-api"
API_SA_NAME="mr-api"
DEPLOY_SA_NAME="mr-github-deployer"
BUCKET="${BUCKET:-${PROJECT_ID}-mr-signed-docs}"
RETENTION="${RETENTION:-5y}"                # retention of signed documents (write-once)
WIF_POOL="github"
WIF_PROVIDER="github-oidc"

API_SA="${API_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SA="${DEPLOY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
WEB_SA="firebase-app-hosting-compute@${PROJECT_ID}.iam.gserviceaccount.com"

say() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }
rand() { openssl rand -base64 "$1" | tr -d '\n'; }

gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

say "API Google Cloud"
gcloud services enable \
  run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com \
  artifactregistry.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  storage.googleapis.com cloudbuild.googleapis.com firebaseapphosting.googleapis.com \
  developerconnect.googleapis.com cloudresourcemanager.googleapis.com logging.googleapis.com \
  cloudscheduler.googleapis.com

say "Artifact Registry (образи API)"
exists gcloud artifacts repositories describe "$AR_REPO" --location "$REGION" ||
  gcloud artifacts repositories create "$AR_REPO" --repository-format=docker --location="$REGION" \
    --description="Образи API військового обліку"
# keep only the 10 most recent images
cat > /tmp/mr-ar-policy.json <<'JSON'
[{"name":"keep-recent","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":10}},
 {"name":"delete-old","action":{"type":"Delete"},"condition":{"tagState":"ANY","olderThan":"30d"}}]
JSON
gcloud artifacts repositories set-cleanup-policies "$AR_REPO" --location "$REGION" --policy=/tmp/mr-ar-policy.json --no-dry-run >/dev/null

say "Cloud SQL (PostgreSQL 16): шифрування, бекапи, PITR, захист від видалення"
if ! exists gcloud sql instances describe "$SQL_INSTANCE"; then
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 --edition=ENTERPRISE --tier="$SQL_TIER" --region="$REGION" \
    --storage-type=SSD --storage-size=10 --storage-auto-increase \
    --backup-start-time=01:00 --retained-backups-count=30 \
    --enable-point-in-time-recovery --retained-transaction-log-days=7 \
    --maintenance-window-day=SUN --maintenance-window-hour=2 \
    --ssl-mode=ENCRYPTED_ONLY \
    --database-flags=log_connections=on,log_disconnections=on \
    --deletion-protection
  # Public IP without any authorized networks: connections only through the Cloud SQL connector (IAM + TLS).
fi
exists gcloud sql databases describe "$DB_NAME" --instance "$SQL_INSTANCE" ||
  gcloud sql databases create "$DB_NAME" --instance "$SQL_INSTANCE"

create_secret() { # name value — creates the secret only if it does not exist yet
  local name="$1" value="$2"
  if exists gcloud secrets describe "$name"; then
    echo "  • $name — вже існує, не змінюю"
  else
    printf '%s' "$value" | gcloud secrets create "$name" \
      --replication-policy=user-managed --locations="$REGION" --data-file=- >/dev/null
    echo "  • $name — створено"
  fi
}

say "Користувач БД і секрети (Secret Manager, лише регіон $REGION)"
if ! exists gcloud secrets describe DATABASE_URL; then
  DB_PASS="$(rand 32 | tr -d '/+=')"
  if exists gcloud sql users describe "$DB_USER" --instance "$SQL_INSTANCE"; then
    gcloud sql users set-password "$DB_USER" --instance "$SQL_INSTANCE" --password "$DB_PASS"
  else
    gcloud sql users create "$DB_USER" --instance "$SQL_INSTANCE" --password "$DB_PASS"
  fi
  create_secret DATABASE_URL "postgres://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=/cloudsql/${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
  unset DB_PASS
fi
create_secret JWT_SECRET "$(rand 48)"
create_secret DATA_ENCRYPTION_KEY "$(rand 32)"   # AES-256-GCM for RNOKPP, passports etc.
create_secret BLIND_INDEX_KEY "$(rand 32)"       # HMAC for searching by RNOKPP
if ! exists gcloud secrets describe ADMIN_PASSWORD; then
  ADMIN_PASSWORD="Tmp-$(rand 18 | tr -d '/+=')9"
  create_secret ADMIN_PASSWORD "$ADMIN_PASSWORD"
  echo "  ⚠ Тимчасовий пароль першого адміністратора (змінити при першому вході): $ADMIN_PASSWORD"
  unset ADMIN_PASSWORD
fi
echo "  ⚠ DATA_ENCRYPTION_KEY / BLIND_INDEX_KEY: без них дані не розшифрувати. Не видаляйте версії секретів."

# Optional: SMTP for e-mail reminders (smtps://user:app-password@smtp.gmail.com:465)
if [ -n "${SMTP_URL:-}" ]; then
  if exists gcloud secrets describe SMTP_URL; then
    printf '%s' "$SMTP_URL" | gcloud secrets versions add SMTP_URL --data-file=- >/dev/null
    echo "  • SMTP_URL — оновлено"
  else
    create_secret SMTP_URL "$SMTP_URL"
  fi
fi

say "Бакет для підписаних документів: без публічного доступу, write-once (retention $RETENTION)"
if ! exists gcloud storage buckets describe "gs://$BUCKET"; then
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention --default-storage-class=STANDARD
  gcloud storage buckets update "gs://$BUCKET" --retention-period="$RETENTION"
  echo "  ℹ Щоб retention не можна було скасувати навіть власнику проєкту: gcloud storage buckets update gs://$BUCKET --lock-retention-period (НЕЗВОРОТНО)"
fi

say "Сервісний акаунт API (мінімальні права)"
exists gcloud iam service-accounts describe "$API_SA" ||
  gcloud iam service-accounts create "$API_SA_NAME" --display-name="Military registry API (runtime)"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$API_SA" \
  --role=roles/cloudsql.client --condition=None >/dev/null
for s in DATABASE_URL JWT_SECRET DATA_ENCRYPTION_KEY BLIND_INDEX_KEY ADMIN_PASSWORD $(exists gcloud secrets describe SMTP_URL && echo SMTP_URL); do
  gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:$API_SA" \
    --role=roles/secretmanager.secretAccessor >/dev/null
done
# Create and read objects only — no delete/overwrite
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$API_SA" \
  --role=roles/storage.objectCreator >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$API_SA" \
  --role=roles/storage.objectViewer >/dev/null

say "Сервісний акаунт для GitHub Actions + Workload Identity Federation (без JSON-ключів)"
exists gcloud iam service-accounts describe "$DEPLOY_SA" ||
  gcloud iam service-accounts create "$DEPLOY_SA_NAME" --display-name="GitHub deployer (API)"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" \
  --role=roles/run.admin --condition=None >/dev/null
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --location "$REGION" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/artifactregistry.writer >/dev/null
# the daily job (reminders, decrees) is started by Cloud Scheduler — the deployer creates it
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" \
  --role=roles/cloudscheduler.admin --condition=None >/dev/null
# the deployer checks whether the optional SMTP_URL secret exists
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" \
  --role=roles/secretmanager.viewer --condition=None >/dev/null
# deploy as the API account (actAs) — granted on that account only, not the whole project
gcloud iam service-accounts add-iam-policy-binding "$API_SA" --member="serviceAccount:$DEPLOY_SA" \
  --role=roles/iam.serviceAccountUser >/dev/null

exists gcloud iam workload-identity-pools describe "$WIF_POOL" --location=global ||
  gcloud iam workload-identity-pools create "$WIF_POOL" --location=global --display-name="GitHub Actions"
exists gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" --location=global --workload-identity-pool="$WIF_POOL" ||
  gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" \
    --location=global --workload-identity-pool="$WIF_POOL" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref,attribute.environment=assertion.environment" \
    --attribute-condition="assertion.repository=='${GITHUB_REPO}' && assertion.ref=='refs/heads/main'"
# the token is issued only to jobs of this repository running in the "production" environment
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.environment/production" >/dev/null

say "Готово. Значення для GitHub → Settings → Secrets and variables → Actions → Variables:"
cat <<EOF
  GCP_PROJECT_ID      = $PROJECT_ID
  GCP_REGION          = $REGION
  GCP_WIF_PROVIDER    = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}
  GCP_DEPLOY_SA       = $DEPLOY_SA
  GCP_API_SA          = $API_SA
  GCP_SQL_INSTANCE    = ${PROJECT_ID}:${REGION}:${SQL_INSTANCE}
  GCP_BUCKET          = $BUCKET
  GCP_WEB_SA          = $WEB_SA
  APP_ORIGIN          = ${APP_DOMAIN:+https://$APP_DOMAIN}${APP_DOMAIN:-https://people-accounting--${PROJECT_ID}.${REGION}.hosted.app}
  ADMIN_EMAIL         = <email першого адміністратора>
  MAIL_FROM           = Військовий облік <ваша-пошта@домен>   (для листів-нагадувань; разом із SMTP_URL)

Далі:
  1. firebase projects:addfirebase $PROJECT_ID   (якщо проєкт ще не Firebase; потрібен тариф Blaze)
  2. firebase apphosting:backends:create --project $PROJECT_ID --location $REGION --backend people-accounting
     (підключіть GitHub-репозиторій, root directory: frontend, гілка main)
  3. Запустіть GitHub Actions «Deploy API» — він створить сервіс і видасть App Hosting право run.invoker.
  4. Впишіть URL API та хости у frontend/apphosting.yaml → push у main.
EOF

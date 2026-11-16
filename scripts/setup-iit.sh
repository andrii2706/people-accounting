#!/usr/bin/env bash
# One-time setup of the KEP check (company sign-up, the offer) for production.
#
#   scripts/setup-iit.sh <IIT package: .zip / .tar.gz / folder> [GCP project id]
#
# The IIT library «Користувач ЦСК» for Node.js is licensed separately: download it yourself from
# https://iit.com.ua/downloads (Linux x64 build). The script then:
#   1) finds the library in the package and checks it locally (Linux only) with the current lists of
#      qualified providers from czo.gov.ua;
#   2) creates a private bucket <project>-iit and uploads the library to gs://<project>-iit/iit;
#   3) lets the GitHub deployer service account read it;
#   4) sets the GitHub variable IIT_BUCKET_PATH (needs the gh CLI; otherwise prints what to set).
# After that run «Deploy API» — the sign-up link appears on the login page.
set -euo pipefail

PACKAGE="${1:-}"
PROJECT_ID="${2:-${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}}"
REGION="${GCP_REGION:-us-east4}"
BUCKET="${IIT_BUCKET:-${PROJECT_ID}-iit}"
DEPLOY_SA="${GCP_DEPLOY_SA:-mr-github-deployer@${PROJECT_ID}.iam.gserviceaccount.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

die() { echo "✗ $*" >&2; exit 1; }

[ -n "$PACKAGE" ] || die "Вкажіть пакет ІІТ: scripts/setup-iit.sh ~/Downloads/<архів ІІТ>.zip [project-id]"
[ -e "$PACKAGE" ] || die "Не знайдено $PACKAGE"
[ -n "$PROJECT_ID" ] || die "Не вказано GCP-проєкт (другий аргумент або gcloud config set project …)"
command -v gcloud >/dev/null || die "Потрібен gcloud"
command -v curl >/dev/null || die "Потрібен curl"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "→ Розпаковую пакет ІІТ"
mkdir -p "$WORK/package"
case "$PACKAGE" in
  *.zip) command -v unzip >/dev/null || die "Потрібен unzip"; unzip -q "$PACKAGE" -d "$WORK/package" ;;
  *.tar.gz | *.tgz) tar -xzf "$PACKAGE" -C "$WORK/package" ;;
  *) [ -d "$PACKAGE" ] || die "Очікується .zip, .tar.gz або папка"; cp -R "$PACKAGE"/. "$WORK/package/" ;;
esac

# the folder with the module of the library — what goes to the bucket
MODULE="$(find "$WORK/package" -path '*/node_modules' -prune -o -type f \
  \( -name euscp.js -o -name euscp.node -o -name EUSignCP.js -o -name eusign.js \) -print | head -n 1)"
[ -n "$MODULE" ] || die "У пакеті немає euscp.js / euscp.node / EUSignCP.js / eusign.js — це точно бібліотека ІІТ для Node.js?"
LIB_DIR="$(dirname "$MODULE")"
echo "  бібліотека: ${MODULE#"$WORK/package/"}"

echo "→ Завантажую списки кваліфікованих надавачів з czo.gov.ua"
for f in CAs.json CACertificates.p7b; do
  curl -fsSL --retry 3 -o "$LIB_DIR/$f" "https://czo.gov.ua/download/certificates/$f" || die "Не вдалося завантажити $f"
done

if [ "$(uname -s)" = "Linux" ] && command -v node >/dev/null; then
  echo "→ Перевіряю бібліотеку локально"
  cp "$ROOT/backend/iit/iit-loader.mjs" "$ROOT/backend/iit/check.mjs" "$LIB_DIR/"
  (cd "$LIB_DIR" && node check.mjs) || die "Бібліотека не ініціалізувалась — див. повідомлення вище і backend/iit/README.md"
  rm "$LIB_DIR/iit-loader.mjs" "$LIB_DIR/check.mjs"
else
  echo "  ℹ Локальна перевірка — лише на Linux (бібліотека для Linux x64); її зробить деплой"
fi

echo "→ Приватний бакет gs://$BUCKET"
if ! gcloud storage buckets describe "gs://$BUCKET" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT_ID" --location "$REGION" \
    --uniform-bucket-level-access --public-access-prevention
fi
# the lists of providers are downloaded on every deploy; the copy in the bucket is a fallback
gcloud storage rsync -r --delete-unmatched-destination-objects "$LIB_DIR" "gs://$BUCKET/iit"

echo "→ Доступ на читання для $DEPLOY_SA"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --project "$PROJECT_ID" \
  --member "serviceAccount:$DEPLOY_SA" --role roles/storage.objectViewer >/dev/null

if command -v gh >/dev/null && (cd "$ROOT" && gh repo view >/dev/null 2>&1); then
  echo "→ Змінна GitHub IIT_BUCKET_PATH"
  (cd "$ROOT" && gh variable set IIT_BUCKET_PATH --body "gs://$BUCKET/iit")
  echo "✓ Готово. Запустіть «Deploy API» (Actions → Deploy API → Run workflow)."
else
  echo "✓ Бакет готовий. Додайте змінну репозиторію (Settings → Secrets and variables → Actions → Variables):"
  echo "    IIT_BUCKET_PATH = gs://$BUCKET/iit"
  echo "  і запустіть «Deploy API»."
fi

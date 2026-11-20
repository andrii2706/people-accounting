#!/usr/bin/env bash
# =============================================================================
# A firewall for web attacks (Google Cloud Armor) in front of the application.
#
# Creates: a global HTTPS load balancer for your domain → the App Hosting service (serverless NEG),
# a Cloud Armor policy on it:
#   • OWASP rules (SQL injection, XSS, file inclusion, command injection, scanners, protocol attacks);
#   • a limit of requests per address (and a much lower one for the sign-in);
#   • only the countries you allow (Ukraine by default).
# The API stays private (IAM) as before — the firewall stands in front of the pages and the /api proxy.
#
# Run (as project Owner) AFTER App Hosting is up and the domain is chosen:
#   PROJECT_ID=accounting-project-1aecf APP_DOMAIN=hr.company.ua WEB_SERVICE=people-accounting ./infra/cloud-armor.sh
# Then point the A record of APP_DOMAIN to the IP the script prints (instead of the App Hosting records).
#
# WAF_PREVIEW=true (default) — the OWASP rules only LOG for the first days (an apostrophe in a name may
#   look like an SQL injection to them) (Logs Explorer:
#   resource.type="http_load_balancer" jsonPayload.previewSecurityPolicy.outcome="DENY");
#   when nothing legitimate is caught, re-run with WAF_PREVIEW=false to block.
# ALLOWED_COUNTRIES="UA" — ISO codes separated by spaces; empty — no country filter.
# LOCK_INGRESS=true — the App Hosting service accepts traffic only through this balancer
#   (the *.hosted.app address stops working — nobody can go around the firewall). Check after the next
#   App Hosting rollout that the setting stayed (gcloud run services describe … --format='value(metadata.annotations)').
#
# Cost (Nov 2026): the balancer ~18 $/month, Cloud Armor 5 $/policy + 1 $/rule a month + 0.75 $ per million
# requests (+ 0.75 $ per million for the OWASP rules). See https://cloud.google.com/armor/pricing
# The script is idempotent: a re-run updates the rules and does not create a second balancer.
# =============================================================================
set -euo pipefail

: "${PROJECT_ID:?Вкажіть PROJECT_ID}"
: "${APP_DOMAIN:?Вкажіть APP_DOMAIN — домен застосунку (hr.company.ua)}"
: "${WEB_SERVICE:?Вкажіть WEB_SERVICE — назву сервісу Cloud Run, який створив App Hosting (ID бекенда)}"
REGION="${REGION:-us-east4}"
POLICY="${POLICY:-mr-web-armor}"
PREFIX="${PREFIX:-mr-web}"
WAF_PREVIEW="${WAF_PREVIEW:-true}"
ALLOWED_COUNTRIES="${ALLOWED_COUNTRIES:-UA}"
LOCK_INGRESS="${LOCK_INGRESS:-false}"
# requests a minute from one address: everything / the sign-in and the code
RATE_ALL="${RATE_ALL:-600}"
RATE_LOGIN="${RATE_LOGIN:-30}"

say() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

gcloud config set project "$PROJECT_ID" >/dev/null
gcloud services enable compute.googleapis.com >/dev/null

say "Політика Cloud Armor ${POLICY}"
exists gcloud compute security-policies describe "$POLICY" ||
  gcloud compute security-policies create "$POLICY" --description="Військовий облік: WAF, ліміти, країни"
# log the whole request line of a blocked request (the body is never logged)
gcloud compute security-policies update "$POLICY" --log-level=VERBOSE >/dev/null

# add or replace one rule
rule() {
  local priority="$1"
  shift
  if exists gcloud compute security-policies rules describe "$priority" --security-policy="$POLICY"; then
    gcloud compute security-policies rules update "$priority" --security-policy="$POLICY" "$@" >/dev/null
  else
    gcloud compute security-policies rules create "$priority" --security-policy="$POLICY" "$@" >/dev/null
  fi
  echo "  правило $priority"
}

# Uploaded files and e-signatures are binary / base64: the OWASP patterns would see «attacks» in them.
# These paths are checked by the application itself (security/utils/file-safety.utils.ts).
# The 1C push carries whole employee records (names with an apostrophe — «Мар'яна») and is let in by its key.
UPLOADS="request.path.matches('^/api/(employees/import/preview|legal-entities/[^/]+/list-settings/[^/]+/template|letters/[^/]+/signatures|auth/register/[^/]+/sign|terms/document/[^/]+/sign|integrations/1c/employees)$')"
PREVIEW_FLAG=$([ "$WAF_PREVIEW" = "true" ] && echo "--preview" || echo "--no-preview")

say "Правила OWASP (режим перегляду: ${WAF_PREVIEW})"
priority=1000
for set in sqli-v33-stable xss-v33-stable lfi-v33-stable rfi-v33-stable rce-v33-stable \
  methodenforcement-v33-stable scannerdetection-v33-stable protocolattack-v33-stable \
  sessionfixation-v33-stable; do
  rule "$priority" --action=deny-403 $PREVIEW_FLAG \
    --expression="evaluatePreconfiguredWaf('${set}', {'sensitivity': 1}) && !${UPLOADS}" \
    --description="OWASP ${set}"
  priority=$((priority + 10))
done

say "Ліміти запитів з однієї адреси"
rule 2000 --action=rate-based-ban \
  --expression="request.path.startsWith('/api/auth/login') || request.path.startsWith('/api/portal/auth/login')" \
  --rate-limit-threshold-count="$RATE_LOGIN" --rate-limit-threshold-interval-sec=60 \
  --ban-duration-sec=900 --conform-action=allow --exceed-action=deny-429 --enforce-on-key=IP \
  --description="Вхід: ${RATE_LOGIN} за хвилину, далі бан на 15 хв"
rule 2100 --action=throttle --src-ip-ranges='*' \
  --rate-limit-threshold-count="$RATE_ALL" --rate-limit-threshold-interval-sec=60 \
  --conform-action=allow --exceed-action=deny-429 --enforce-on-key=IP \
  --description="Усе: ${RATE_ALL} за хвилину"

if [ -n "$ALLOWED_COUNTRIES" ]; then
  say "Лише країни: ${ALLOWED_COUNTRIES}"
  list=$(printf "'%s'," $ALLOWED_COUNTRIES)
  rule 3000 --action=deny-403 \
    --expression="!(origin.region_code in [${list%,}])" \
    --description="Країни, крім ${ALLOWED_COUNTRIES}"
elif exists gcloud compute security-policies rules describe 3000 --security-policy="$POLICY"; then
  gcloud compute security-policies rules delete 3000 --security-policy="$POLICY" --quiet
fi

say "Балансувальник для ${APP_DOMAIN} → ${WEB_SERVICE}"
exists gcloud compute network-endpoint-groups describe "${PREFIX}-neg" --region="$REGION" ||
  gcloud compute network-endpoint-groups create "${PREFIX}-neg" --region="$REGION" \
    --network-endpoint-type=serverless --cloud-run-service="$WEB_SERVICE"
if ! exists gcloud compute backend-services describe "${PREFIX}-backend" --global; then
  gcloud compute backend-services create "${PREFIX}-backend" --global \
    --load-balancing-scheme=EXTERNAL_MANAGED --enable-logging --logging-sample-rate=1
  gcloud compute backend-services add-backend "${PREFIX}-backend" --global \
    --network-endpoint-group="${PREFIX}-neg" --network-endpoint-group-region="$REGION"
fi
gcloud compute backend-services update "${PREFIX}-backend" --global --security-policy="$POLICY" >/dev/null

exists gcloud compute url-maps describe "${PREFIX}-map" ||
  gcloud compute url-maps create "${PREFIX}-map" --default-service="${PREFIX}-backend"
exists gcloud compute ssl-certificates describe "${PREFIX}-cert" --global ||
  gcloud compute ssl-certificates create "${PREFIX}-cert" --global --domains="$APP_DOMAIN"
exists gcloud compute ssl-policies describe "${PREFIX}-tls" ||
  gcloud compute ssl-policies create "${PREFIX}-tls" --profile=MODERN --min-tls-version=1.2
exists gcloud compute target-https-proxies describe "${PREFIX}-https" ||
  gcloud compute target-https-proxies create "${PREFIX}-https" --url-map="${PREFIX}-map" \
    --ssl-certificates="${PREFIX}-cert" --ssl-policy="${PREFIX}-tls"
exists gcloud compute addresses describe "${PREFIX}-ip" --global ||
  gcloud compute addresses create "${PREFIX}-ip" --global --ip-version=IPV4
exists gcloud compute forwarding-rules describe "${PREFIX}-443" --global ||
  gcloud compute forwarding-rules create "${PREFIX}-443" --global --load-balancing-scheme=EXTERNAL_MANAGED \
    --address="${PREFIX}-ip" --target-https-proxy="${PREFIX}-https" --ports=443

# http → https
if ! exists gcloud compute url-maps describe "${PREFIX}-redirect"; then
  cat > /tmp/mr-redirect.yaml <<YAML
name: ${PREFIX}-redirect
defaultUrlRedirect:
  httpsRedirect: true
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
YAML
  gcloud compute url-maps import "${PREFIX}-redirect" --global --source=/tmp/mr-redirect.yaml --quiet
fi
exists gcloud compute target-http-proxies describe "${PREFIX}-http" ||
  gcloud compute target-http-proxies create "${PREFIX}-http" --url-map="${PREFIX}-redirect"
exists gcloud compute forwarding-rules describe "${PREFIX}-80" --global ||
  gcloud compute forwarding-rules create "${PREFIX}-80" --global --load-balancing-scheme=EXTERNAL_MANAGED \
    --address="${PREFIX}-ip" --target-http-proxy="${PREFIX}-http" --ports=80

if [ "$LOCK_INGRESS" = "true" ]; then
  say "Сервіс ${WEB_SERVICE} — лише через балансувальник"
  gcloud run services update "$WEB_SERVICE" --region="$REGION" --ingress=internal-and-cloud-load-balancing
fi

IP=$(gcloud compute addresses describe "${PREFIX}-ip" --global --format='value(address)')
say "Готово"
cat <<TXT
  1. DNS: запис A  ${APP_DOMAIN} → ${IP}  (записи App Hosting для цього домену приберіть).
  2. Сертифікат з'явиться за 15–60 хв після DNS:
       gcloud compute ssl-certificates describe ${PREFIX}-cert --global --format='value(managed.status)'
  3. У frontend/apphosting.yaml: TRUST_PROXY_HOPS — на 1 більше (з'явився ще один проксі), NG_ALLOWED_HOSTS — з ${APP_DOMAIN}.
  4. Тиждень дивіться журнал (WAF у режимі перегляду), потім: WAF_PREVIEW=false ./infra/cloud-armor.sh
  5. Коли все працює через домен: LOCK_INGRESS=true ./infra/cloud-armor.sh — обійти фаєрвол стане неможливо.
TXT

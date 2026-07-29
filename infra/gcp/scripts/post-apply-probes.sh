#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ID="$(terraform -chdir="$ROOT" output -raw project_id)"
REGION="$(terraform -chdir="$ROOT" output -raw region)"
SQL_CONNECTION="$(terraform -chdir="$ROOT" output -raw cloud_sql_connection_name)"
SQL_INSTANCE="${SQL_CONNECTION##*:}"
SERVICE_URI="$(terraform -chdir="$ROOT" output -raw cloud_run_uri 2>/dev/null || true)"
CERTIFICATE="$(terraform -chdir="$ROOT" output -raw static_certificate_name 2>/dev/null || true)"
CDN_BACKEND="$(terraform -chdir="$ROOT" output -raw static_backend_bucket_name 2>/dev/null || true)"

echo "Checking Cloud Run health..."
if [[ -n "$SERVICE_URI" && "$SERVICE_URI" != "null" ]]; then
  if ! curl -fsS "${SERVICE_URI}/api/v1/health"; then
    curl -fsS \
      -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
      "${SERVICE_URI}/api/v1/health"
  fi
else
  echo "SKIP: Cloud Run is not managed yet (cloud_run_image is empty)."
fi

echo "Checking Cloud SQL readiness..."
gcloud sql instances describe "$SQL_INSTANCE" \
  --project="$PROJECT_ID" \
  --format='table(name,state,region,databaseVersion,settings.availabilityType)'

echo "Checking Secret Manager versions..."
while IFS= read -r secret_id; do
  [[ -z "$secret_id" ]] && continue
  gcloud secrets versions list "$secret_id" \
    --project="$PROJECT_ID" \
    --limit=1 \
    --sort-by='~createTime' \
    --format='table(name,state,createTime)'
done < <(terraform -chdir="$ROOT" output -json secret_ids | jq -r '.[]')

echo "Checking load-balancer certificate..."
if [[ -n "$CERTIFICATE" && "$CERTIFICATE" != "null" ]]; then
  gcloud compute ssl-certificates describe "$CERTIFICATE" \
    --project="$PROJECT_ID" \
    --global \
    --format='table(name,managed.status,managed.domains)'
else
  echo "SKIP: static CDN delivery is disabled."
fi

echo "Checking CDN backend..."
if [[ -n "$CDN_BACKEND" && "$CDN_BACKEND" != "null" ]]; then
  gcloud compute backend-buckets describe "$CDN_BACKEND" \
    --project="$PROJECT_ID" \
    --format='table(name,enableCdn,bucketName)'
else
  echo "SKIP: static CDN delivery is disabled."
fi

echo "Post-apply probes completed for ${PROJECT_ID}/${REGION}."

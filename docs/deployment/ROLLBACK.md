# Rollback and recovery (GCP stage)

Use this after a bad API deploy, bad static sync, or failed migration. Prefer rolling forward with a known-good image when possible.

## Cloud Run — instant traffic rollback

List revisions:

```bash
PROJECT_ID="jobseek-459701"
REGION="us-central1"
SERVICE="100x-staging-api"   # or: terraform -chdir=infra/gcp output -raw cloud_run_service_name

gcloud run revisions list \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --service="$SERVICE"
```

Route 100% traffic to the last known-good revision:

```bash
GOOD_REVISION="100x-staging-api-00042-abc"

gcloud run services update-traffic "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --to-revisions="${GOOD_REVISION}=100"
```

Verify:

```bash
URI="$(gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
curl -fsS -H "Authorization: Bearer $(gcloud auth print-identity-token)" "${URI}/api/v1/health"
```

## Cloud Run — redeploy a previous image tag

```bash
IMAGE_BASE="us-central1-docker.pkg.dev/jobseek-459701/100x/api"
GOOD_TAG="abc1234"   # previous git short SHA

gcloud run deploy "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="${IMAGE_BASE}:${GOOD_TAG}"
```

Keep image tags immutable (`:staging` floating tag is convenience-only; prefer git SHA tags for rollback).

## Static assets bucket

Prefer rebuilding a known-good commit or downloading a retained CI build artifact,
then re-syncing the complete app prefix. Build with the same base path used by
deployment:

```bash
STATIC_BUCKET="$(terraform -chdir=infra/gcp output -raw static_assets_bucket)"

npm ci
npm run build -w 100x-web -- --base=/web/
gcloud storage rsync --recursive --delete-unmatched-destination-objects \
  web/dist "gs://${STATIC_BUCKET}/web"

gcloud storage objects update "gs://${STATIC_BUCKET}/web/assets/**" \
  --cache-control="public,max-age=31536000,immutable"
gcloud storage objects update "gs://${STATIC_BUCKET}/web/index.html" \
  --cache-control="no-cache,max-age=0,must-revalidate"
```

Use `/mobile/` and `100x-mobile` for a mobile rollback.

GCS versioning is also enabled. For a single-object recovery, list versions and
copy a known-good generation over the live object:

```bash
gcloud storage ls --all-versions "gs://${STATIC_BUCKET}/web/index.html"
gcloud storage cp \
  "gs://${STATIC_BUCKET}/web/index.html#GENERATION" \
  "gs://${STATIC_BUCKET}/web/index.html"
gcloud storage objects update "gs://${STATIC_BUCKET}/web/index.html" \
  --cache-control="no-cache,max-age=0,must-revalidate"
```

Restoring only `index.html` is safe only when its referenced fingerprinted
assets still exist. Prefer a complete known-good build for multi-file failures.
If CDN delivery is enabled, invalidate the rolled-back prefix after upload:

```bash
URL_MAP="$(terraform -chdir=infra/gcp output -raw static_url_map_name)"
gcloud compute url-maps invalidate-cdn-cache "$URL_MAP" \
  --path="/web/*" \
  --async
```

Wait for invalidation completion, then verify `https://stage.aplifyai.com/web/` (or
`https://stage.aplifyai.com/mobile/`) in a fresh browser session. Do not invalidate the entire cache
unless both apps are affected.

## Cloud SQL

- **Automated backups** and PITR are enabled when `sql_backup_enabled = true` (default).
- Restore via Console or:

```bash
gcloud sql backups list --instance=100x-staging-pg --project="$PROJECT_ID"
# restore to a *new* instance first; cut over only after verification
gcloud sql backups restore BACKUP_ID \
  --backup-instance=100x-staging-pg \
  --backup-project="$PROJECT_ID" \
  --project="$PROJECT_ID"
```

Prefer restore-to-new-instance + app cutover over in-place surprises.

## Secrets

Secret Manager versions are immutable. If a bad secret was published:

```bash
gcloud secrets versions list SECRET_ID --project="$PROJECT_ID"
# disable the bad version
gcloud secrets versions disable VERSION --secret=SECRET_ID --project="$PROJECT_ID"
# ensure Cloud Run still points at :latest of a good version (add a good version if needed)
gcloud run services update "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --update-secrets=AUTH_SESSION_SECRET=SECRET_ID:GOOD_VERSION
```

## Terraform mistakes

- Do **not** `terraform destroy` staging once it holds real data.
- Prefer `terraform plan` + targeted fixes.
- If state is wrong, recover from the configured backend (once GCS remote state is enabled) — never commit state files.
- `sql_deletion_protection = true` blocks accidental instance destroy; disable only deliberately.

## Incident order of operations

1. Confirm blast radius (`/api/v1/health`, Cloud Monitoring 5xx alert, Logging).
2. Roll Cloud Run traffic to last good revision (fastest).
3. If data corruption: stop writes, restore SQL to a new instance, validate, cut over.
4. If secret leak: rotate secret, disable old versions, redeploy.
5. Write a short postmortem: bad revision/tag, detection time, fix, follow-up.

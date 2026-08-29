# GCP staging deployment

Production-shaped **stage** environment in shared non-production Project A.
Dev also lives in this project, but uses separate names, networking, tfvars,
and remote state.

Locked deployment target: GCP project `jobseek-459701` and domain
`stage.aplifyai.com`. Commands in this guide mutate GCP and must only be run by an
authorized operator; repository validation does not run them.

Related:

- Infrastructure: [`infra/gcp/`](../../infra/gcp/)
- Rollback: [ROLLBACK.md](ROLLBACK.md)
- Master plan: [MASTER_PLAN.md](../MASTER_PLAN.md)

## Architecture (staging baseline)

```text
                  ┌─────────────────────────┐
  Clients ───────►│ Cloud Run (API)         │──► Secret Manager
  (web/mobile)    │  · Artifact Registry    │──► Cloud SQL (Postgres)
                  │  · /api/v1/health       │──► GCS artifacts bucket
                  └─────────────────────────┘
                              │
        optional HTTPS LB + Cloud CDN + managed certificate
                              │
                  GCS static bucket (/web, /mobile)
                  Cloud Logging / Monitoring
```

**In this baseline**

- API: Cloud Run + Artifact Registry image
- Data: Cloud SQL PostgreSQL through `DATABASE_URL`; the current JSONB snapshot repository is durable but single-writer
- Secrets: Secret Manager (no secrets in git or client bundles)
- Artifacts / static: two Cloud Storage buckets; the static bucket can optionally be delivered through HTTPS Cloud CDN
- IAM: dedicated runtime + deployer service accounts

**Follow-up (not in first apply)**

- Cloud Armor / Identity-Aware Proxy

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Dedicated GCP project | Billing on; empty or 100x-only |
| `gcloud` CLI | Authenticated to **that** project only for these steps |
| Terraform >= 1.5 | `cd infra/gcp && terraform init` |
| Node.js 22 + npm 10 | Build the web and mobile Vite clients |
| Docker | Build/push API image |
| Roles | Ability to enable APIs and create Run/SQL/AR/GCS/IAM/Secrets/Compute resources; Cloud DNS permissions only when Terraform manages records |
| Frontend domains (optional) | One or more names you control; an existing Cloud DNS managed zone, or access to create A records externally |

Never put Jira tokens, OpenAI keys, DB passwords, or project-bound SA keys in the repository.

## 1. Bootstrap infrastructure

```bash
cd infra/gcp
cp terraform.stage.tfvars.example terraform.stage.tfvars
cp backend.stage.hcl.example backend.stage.hcl
# Confirm project_id, state bucket/prefix, and leave cloud_run_image empty.
terraform init -reconfigure -backend-config=backend.stage.hcl
terraform plan -var-file=terraform.stage.tfvars -out=stage.tfplan
terraform apply stage.tfplan
```

For the existing local stage state, use `terraform init -migrate-state` instead
of `-reconfigure`. Follow the migration guardrails in
[`infra/gcp/README.md`](../../infra/gcp/README.md); the `stage` input preserves
the existing `100x-staging-*` names.

Capture outputs (image base, buckets, secret IDs, SQL connection name):

```bash
terraform output
```

## 2. Replace placeholder secrets

Terraform creates secret **shells** and placeholder versions. Set real values out-of-band:

```bash
# Examples — use your secret IDs from terraform output
echo -n 'a-long-random-session-secret' | gcloud secrets versions add SECRET_ID_SESSION --data-file=-
echo -n "$OPENAI_API_KEY" | gcloud secrets versions add SECRET_ID_OPENAI --data-file=-
echo -n "$JIRA_API_TOKEN" | gcloud secrets versions add SECRET_ID_JIRA --data-file=-
# DATABASE_URL is bootstrapped from Cloud SQL; rotate if required
```

Set optional non-secret Jira connection values (`jira_base_url`, `jira_email`) in the untracked `terraform.tfvars`. Keep `JIRA_API_TOKEN` in Secret Manager.

## 3. Build and push the API image

From the **repository root**:

```bash
PROJECT_ID="$(terraform -chdir=infra/gcp output -raw project_id)"
REGION="$(terraform -chdir=infra/gcp output -raw region)"
IMAGE_BASE="$(terraform -chdir=infra/gcp output -raw artifact_registry_image_base)"
TAG="$(git rev-parse --short HEAD)"

gcloud auth configure-docker "${REGION}-docker.pkg.dev"

docker build -f backend/Dockerfile -t "${IMAGE_BASE}:${TAG}" -t "${IMAGE_BASE}:staging" .
docker push "${IMAGE_BASE}:${TAG}"
docker push "${IMAGE_BASE}:staging"
```

## 4. Deploy Cloud Run

**Option A — Terraform** (set image, re-apply):

```hcl
# in terraform.tfvars
cloud_run_image = "us-central1-docker.pkg.dev/jobseek-459701/100x/api:TAG"
# Required for browser access through the same-origin HTTPS load balancer.
cloud_run_allow_unauthenticated = true
auth_allow_demo_login           = false
```

```bash
terraform apply
```

**Option B — gcloud** (CI-friendly; Terraform `lifecycle.ignore_changes` on image avoids thrash):

```bash
SERVICE="$(terraform -chdir=infra/gcp output -raw cloud_run_service_name)"
# If the service does not exist yet, first apply with cloud_run_image set once,
# or create with:
gcloud run deploy 100x-staging-api \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="${IMAGE_BASE}:${TAG}" \
  --service-account="$(terraform -chdir=infra/gcp output -raw api_service_account_email)" \
  --add-cloudsql-instances="$(terraform -chdir=infra/gcp output -raw cloud_sql_connection_name)" \
  --set-secrets="DATABASE_URL=100x-staging-database-url:latest,AUTH_SESSION_SECRET=100x-staging-session-secret:latest,OPENAI_API_KEY=100x-staging-openai-api-key:latest,JIRA_API_TOKEN=100x-staging-jira-api-token:latest" \
  --set-env-vars="NODE_ENV=production,AUTH_ALLOW_DEMO_LOGIN=0,ARTIFACTS_BUCKET=$(terraform -chdir=infra/gcp output -raw artifacts_bucket)" \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=1 \
  --allow-unauthenticated
```

Secret resource IDs follow `{name_prefix}-{environment}-{key}` (defaults: `100x-staging-database-url`, etc.). Confirm with `terraform output secret_ids`.

## 5. Static web / mobile

### Optional HTTPS load balancer and CDN

The default remains private: `enable_static_cdn = false` creates no frontend
load-balancing resources and keeps public-access prevention enforced. To opt in,
add at least one custom domain:

```hcl
# terraform.tfvars
enable_static_cdn = true
static_domains    = ["stage.aplifyai.com"]

# Optional: create A records in an existing Cloud DNS zone.
# Leave empty when DNS is managed outside this project.
static_dns_managed_zone = "aplifyai-com"
```

Review `terraform plan` carefully: enabling delivery grants `allUsers` object
viewer on the shared static bucket, which is required by the backend bucket.
Apply Terraform before uploading. If DNS is external, point every
`static_domains` name at `terraform output -raw static_load_balancer_ip`.
Certificate provisioning starts after DNS resolves to that address and can take
time. There is intentionally no plaintext HTTP listener; use HTTPS only.

The load balancer routes `/api/*` to Cloud Run, preserving the clients'
same-origin `API_BASE`. All other paths use the CDN-backed bucket. The stack has
one shared bucket, so web and mobile are published under distinct
prefixes. A domain serves the same object tree; use `/web/` and `/mobile/`.
This setup does not provide an SPA rewrite for arbitrary deep links—clients
must use hash routing or another fallback-capable origin if refreshable deep
links are required.

Build clients pointing at the Cloud Run API URL, then sync to the static bucket:

```bash
STATIC_BUCKET="$(terraform -chdir=infra/gcp output -raw static_assets_bucket)"

# From the repository root. The explicit bases keep generated asset URLs under
# each app's bucket prefix.
npm ci
npm run build -w 100x-web -- --base=/web/
npm run build -w 100x-mobile -- --base=/mobile/

gcloud storage rsync --recursive --delete-unmatched-destination-objects \
  web/dist "gs://${STATIC_BUCKET}/web"
gcloud storage rsync --recursive --delete-unmatched-destination-objects \
  mobile/dist "gs://${STATIC_BUCKET}/mobile"

# Cache fingerprinted Vite assets for one year. Keep entry points and PWA
# metadata revalidatable so deployments and rollbacks become visible promptly.
gcloud storage objects update "gs://${STATIC_BUCKET}/web/assets/**" \
  --cache-control="public,max-age=31536000,immutable"
gcloud storage objects update "gs://${STATIC_BUCKET}/mobile/assets/**" \
  --cache-control="public,max-age=31536000,immutable"
gcloud storage objects update \
  "gs://${STATIC_BUCKET}/web/index.html" \
  "gs://${STATIC_BUCKET}/mobile/index.html" \
  "gs://${STATIC_BUCKET}/mobile/manifest.json" \
  "gs://${STATIC_BUCKET}/mobile/sw.js" \
  --cache-control="no-cache,max-age=0,must-revalidate"
```

After a CDN-backed update, invalidate only the changed prefixes:

```bash
URL_MAP="$(terraform -chdir=infra/gcp output -raw static_url_map_name)"
gcloud compute url-maps invalidate-cdn-cache "$URL_MAP" --path="/web/*" --async
gcloud compute url-maps invalidate-cdn-cache "$URL_MAP" --path="/mobile/*" --async
```

Invalidation is unnecessary while CDN delivery is disabled. In that mode,
inspect objects with authenticated `gcloud storage` access or run Vite locally.

## 6. Smoke checks

```bash
URI="$(terraform -chdir=infra/gcp output -raw cloud_run_uri)"
# If the service is authenticated:
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" "${URI}/api/v1/health"
# If you enabled unauthenticated invoke:
curl "${URI}/api/v1/health"
```

Expect JSON with `status: "ok"`. Then exercise login → triage → audit on staging as needed.

Run the full read-only probe suite after apply:

```bash
bash infra/gcp/scripts/post-apply-probes.sh
```

## 7. Data durability note

Cloud Run disks are ephemeral. **Do not rely on `PERSIST=1` / `store.json` in staging.** With `DATABASE_URL`, the backend loads and saves a PostgreSQL JSONB snapshot using optimistic version checks. This is durable for staging, but deliberately single-writer: keep `cloud_run_max_instances = 1`. Move to normalized row-level repositories before horizontal production scaling.

## Security checklist

- [ ] Dedicated project (not a shared personal project)
- [ ] Placeholder secrets replaced
- [ ] `cloud_run_allow_unauthenticated` left `false` unless deliberately public
- [ ] No credentials in client env bundles
- [ ] SQL deletion protection enabled once real data exists
- [ ] Stage uses its own GCS state prefix (`100x/stage`), separate from dev
- [ ] `auth_allow_demo_login = false`

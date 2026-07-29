# GCP multi-environment infrastructure (Terraform)

AplifyAI runs `dev` and `stage` in shared Project A (`jobseek-459701`).
Production uses the separate Project B `aplifyai-prod-2026`.

| Environment | Project | Domain | Subnet example | Resource suffix |
|-------------|---------|--------|----------------|-----------------|
| `dev` | `jobseek-459701` | `dev.aplifyai.com` | `10.20.0.0/24` | `dev` |
| `stage` | `jobseek-459701` | `stage.aplifyai.com` | `10.10.0.0/24` | `staging` (compatibility) |
| `production` | `aplifyai-prod-2026` | `aplifyai.com` | `10.30.0.0/24` | `production` |

The `stage` input maps to the existing `aplifyai-staging-*` resource names.
This avoids renaming or destroying the current stack when its tfvars move from
the legacy value `staging` to `stage`.

## What this stack creates

| Resource | Purpose |
|----------|---------|
| Artifact Registry | Container images for the API |
| Cloud Run (optional) | API service once `cloud_run_image` is set |
| Cloud SQL PostgreSQL 16 | Durable DB (private IP + PSA) |
| Secret Manager | `database-url`, `session-secret`, `openai-api-key`, `jira-api-token` shells |
| Cloud Storage | Artifacts bucket + static assets bucket |
| HTTPS frontend delivery (optional) | Global load balancer, Cloud CDN, managed certificate, and optional Cloud DNS records |
| IAM service accounts | Runtime (`*-api`) and deployer (`*-deployer`) |
| Logging + Monitoring | Custom log bucket/sink, optional 5xx alert + uptime check |

## Optional and deferred components

- **Cloud CDN + HTTPS load balancer** is opt-in (`enable_static_cdn` plus `static_domains`); defaults create no delivery resources and keep the static bucket private.
- **Cloud Armor / IAP** in front of Cloud Run.
- **Remote Terraform state bucket bootstrap** — the backend is configured by
  the supplied per-environment files, but its bucket must exist first.
- **Normalized relational persistence** — the application now uses a guarded PostgreSQL JSONB snapshot when `DATABASE_URL` is set. Keep Cloud Run at one instance until this is replaced with row-level repositories.

## Prerequisites

1. Access to the target GCP project (billing enabled).
2. Local tools: `terraform` >= 1.5, `gcloud`, Docker.
3. Auth as a user/SA that can enable APIs and create the resources above (`roles/owner` or equivalent on the empty project is simplest for first bootstrap).
4. A copied environment tfvars file (never committed):

```bash
cd infra/gcp
ENVIRONMENT=stage # dev, stage, or prod
cp "terraform.${ENVIRONMENT}.tfvars.example" "terraform.${ENVIRONMENT}.tfvars"
```

## Remote state (required)

Each environment must have a different state prefix. Dev and stage may use one
versioned, access-restricted GCS bucket in Project A, but must not share a state
object. Production state belongs in Project B.

```bash
cp backend.stage.hcl.example backend.stage.hcl
# Bootstrap the named bucket once, outside this stack, with versioning,
# uniform bucket-level access, public-access prevention, and least-privilege IAM.
terraform init -reconfigure -backend-config=backend.stage.hcl
```

Use the matching `backend.dev.hcl.example` or `backend.prod.hcl.example`.
Backend files without `.example` are ignored and may contain the final bucket
name. Never initialize one working directory against one environment's backend
and plan with another environment's tfvars; rerun `terraform init -reconfigure`.

### Existing stage state migration

Do not start the existing stage stack with an empty remote state. First back up
the local state, update the untracked tfvars from `environment = "staging"` to
`environment = "stage"`, and migrate the state:

```bash
cp terraform.tfstate "terraform.tfstate.backup.$(date +%Y%m%d%H%M%S)"
cp backend.stage.hcl.example backend.stage.hcl
terraform init -migrate-state -backend-config=backend.stage.hcl
terraform plan -var-file=terraform.stage.tfvars
```

The plan may update labels and, if adopting the locked stage domain, replace
the managed certificate using create-before-destroy. It should not destroy and
recreate the VPC, SQL instance, buckets, service accounts, or Cloud Run service.
Stop if it does. Do not use `terraform state mv`, imports, or `-target` merely
to silence unexpected replacement.

## Plan and apply (operator-run only)

```bash
cd infra/gcp
terraform init -reconfigure -backend-config=backend.stage.hcl
terraform plan \
  -var-file=terraform.stage.tfvars \
  -out=stage.tfplan
# Apply only after the checklist below is approved:
terraform apply stage.tfplan
```

Leave `cloud_run_image = ""` on the first apply so registry, SQL, buckets, secrets, and IAM exist before the first push.

### Plan checklist

- Correct project, environment, state bucket, and unique state prefix.
- Expected domain and VPC CIDR; no overlap with connected networks.
- No unexpected deletes, replacements, or resource renames.
- Stage/production demo login is `false`; production SQL is regional and
  deletion-protected.
- Public Cloud Run invocation and static-bucket IAM are intentional.
- Secret values are absent from the plan and placeholder versions will be
  replaced before traffic.
- Estimated SQL, load-balancer, logging, and egress cost is accepted.

## Repository validation

Validation is local-only and never applies infrastructure:

```bash
bash infra/gcp/scripts/validate.sh
```

This runs recursive `terraform fmt -check`, initializes providers with the
backend disabled, and runs `terraform validate`.

## Post-apply probes

After an authorized operator applies an environment, initialize that
environment's backend and run:

```bash
bash infra/gcp/scripts/post-apply-probes.sh
```

The script checks the health endpoint, Cloud SQL state, latest secret versions,
managed certificate status, and Cloud CDN backend. It requires `gcloud`, `curl`,
`jq`, Terraform outputs, and read access to the target project. It performs no
writes.

## Push an image and deploy the API

See [docs/deployment/GCP_STAGING.md](../../docs/deployment/GCP_STAGING.md) and [docs/deployment/ROLLBACK.md](../../docs/deployment/ROLLBACK.md).

## Safety

- Project IDs and public domains may be documented; credentials and secret values never belong in git.
- `*.tfvars` and state files are gitignored.
- SQL deletion protection defaults to and remains `true` in all environment examples.
- Placeholder secret versions are `REPLACE_ME_*`; overwrite them with `gcloud secrets versions add` before any real traffic.
- When static delivery is enabled with a Cloud Run image, the HTTPS load balancer sends `/api/*` to Cloud Run and all other paths to the CDN-backed static bucket.

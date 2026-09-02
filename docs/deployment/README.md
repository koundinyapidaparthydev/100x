# Deployment docs

| Doc | Purpose |
|-----|---------|
| [../../DEMO_STAGING.md](../../DEMO_STAGING.md) | Code MVP local compose URLs (this deploy) |
| [GCP_STAGING.md](GCP_STAGING.md) | Project A stage deployment: Terraform, image build/push, secrets, smoke checks |
| [ROLLBACK.md](ROLLBACK.md) | Cloud Run traffic rollback, image re-deploy, SQL/secret recovery |

The infrastructure supports `dev`, `stage`, and `production`. Dev and stage use
Project A (`jobseek-459701`) with separate remote state and domains;
production uses the isolated Project B `100x-prod-2026`. See
[`infra/gcp/README.md`](../../infra/gcp/README.md) for the environment matrix,
state migration, validation, and plan checklist.

## CI/CD promotion gates

Workflows under `.github/workflows/` provide:

- `ci.yml`: typecheck, unit tests, and builds
- `e2e.yml`: callable/manual/PR Playwright gate for the `100x-web` workspace
- `infra-validate.yml`: Terraform formatting and validation for `infra/**` PRs
- `stage-deploy.yml`: build, push, resolve the image digest, and deploy staging
- `promote-production.yml`: manually promote that exact digest after approval
  through the GitHub `production` environment
- `mobile-e2e.yml`: manual Detox lane for the Expo React Native app

Configure these GitHub repository or environment variables:

- `GCP_PROJECT_ID`
- `GCP_REGION` (for example, `us-central1`)
- `GCP_ARTIFACT_REPOSITORY` (for example, `100x`)
- `GCP_STAGING_CLOUD_RUN_SERVICE`
- `GCP_PRODUCTION_CLOUD_RUN_SERVICE`

Configure these as GitHub environment secrets for both `staging` and
`production` (use distinct least-privilege identities where possible):

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: full Workload Identity Provider resource
- `GCP_DEPLOY_SERVICE_ACCOUNT`: deployer service-account email

Do not add a service-account JSON key. Grant the GitHub OIDC principal
`roles/iam.workloadIdentityUser`; grant the deployer only the Artifact Registry
read/write and Cloud Run deployment permissions it needs. Configure required
reviewers on the `production` GitHub environment to activate the approval gate.
Cloud Run runtime secrets and environment settings remain managed out of band;
the deployment workflows only update the image digest.

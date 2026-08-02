# Cloud Customization

Customers choose **where data is stored** and **where AI runs**. AplifyAI is cloud-agnostic at the policy layer and adapter-based at the implementation layer.

## Account source (product choice)

When a workspace has (or will) connect AWS, Azure, GCP, or NVIDIA, onboarding and **Governance → Cloud runtime** ask:

| Choice | Policy `mode` | Meaning |
|--------|---------------|---------|
| **Connected cloud accounts** | `customer_cloud` | Run AI in accounts already linked from the stack. We use **their** AWS/Azure/GCP/NVIDIA account — we do not create a separate AplifyAI account in that cloud. |
| **AplifyAI private cloud** | `public_managed` | Run on our managed private plane. No customer cloud account required. |
| **Your cloud (BYOC)** | `private_vpc` | Bring-your-own-cloud. Customer picks the platform (AWS, Azure, GCP, NVIDIA, generic private, or other) and connects that account under Connections. |

After choosing connected accounts or BYOC, the customer selects the **specific** platform. Connected mode prefers platforms already selected/linked; BYOC offers the full platform list.

## Supported targets (planned)

| Target | Storage | AI / compute | Notes |
|--------|---------|--------------|-------|
| AWS | S3, RDS, Secrets Manager, KMS | ECS/EKS, Bedrock, private VPC endpoints | First-class |
| Microsoft Azure | Blob, Azure SQL, Key Vault | AKS, Azure OpenAI, Private Link | First-class |
| Google Cloud | GCS, Cloud SQL, Secret Manager, CMEK | GKE, Vertex AI, Private Google Access | First-class |
| NVIDIA | Customer object store + secrets | DGX Cloud / NGC / customer GPU runners | First-class private GPU path |
| Generic private cloud | Customer object store + DB | Customer GPU/CPU runners | Via standard adapters |
| Custom / other platform | Customer-defined | Customer-defined runners | Free-text label (e.g. Oracle, CoreWeave, on-prem) |
| AplifyAI managed | Our regions | Our controlled runners | Default for pilots |

Private / customer modes (`private_vpc`, `customer_cloud`) let the org pick **AWS, Azure, GCP, NVIDIA, generic private, or any other named platform**.

## What customers customize

1. **Artifact storage location** — drafts, patches, logs
2. **AI execution location** — model inference + agent runner
3. **Secrets / KMS** — who holds encryption keys
4. **Network posture** — public, private link, no egress except allowlisted
5. **Region / residency** — e.g. EU-only

## Policy model

```yaml
cloudPolicy:
  storage:
    provider: aws | azure | gcp | nvidia | private | custom | managed
    region: string
    bucketOrContainer: string
    cmk: optional
  execution:
    provider: aws | azure | gcp | nvidia | private | custom | managed
    customLabel: optional   # required when provider=custom
    mode: public_managed | private_vpc | customer_cloud
    modelGateway: string
  network:
    allowPublicModelApis: boolean
    egressAllowlist: [hosts]
```

Storage and execution providers **may differ**.

## Connection flow

1. Founder selects provider in web control plane.
2. Connect via OIDC / IAM role assumption (preferred) or short-lived credentials.
3. AplifyAI validates permissions with least privilege (write artifacts, invoke model gateway, read secrets).
4. Health check job runs in the customer environment.
5. Policy becomes available to orchestrator.

Never store long-lived access keys in application DB without vault wrapping.

## Private vs public generative AI

| Mode | Meaning |
|------|---------|
| Public cloud GenAI | Use provider APIs (OpenAI-compatible, Bedrock, Azure OpenAI, Vertex) under customer account |
| Private GenAI | Models hosted in customer VPC / dedicated endpoints; no training on customer data |
| Hybrid | Embeddings private; generation public — only if policy allows |

“Our genic area” / managed GenAI is an optional AplifyAI-hosted plane for customers who do not bring their own — still subject to PII firewall and audit.

## Scaling story

- **Small projects**: managed cloud, shared runners, elevated security
- **Large enterprises**: dedicated deployment, CMK, private endpoints, custom MCP allowlists

## Agent implementation guidance

- One `CloudAdapter` interface: `putArtifact`, `getSecret`, `invokeModel`, `ensureNetworkPolicy`
- Per-provider adapters under `integrations/cloud/{aws,azure,gcp,private}`
- Integration tests with localstack / emulators where possible
- Document IAM permission matrices per provider in this folder as they are added

Related: [SECURITY.md](../security/SECURITY.md), [MODEL_PLATFORM_CONFIG.md](../ai/MODEL_PLATFORM_CONFIG.md).

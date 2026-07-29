# Cloud Customization

Customers choose **where data is stored** and **where AI runs**. OffshoreHelper is cloud-agnostic at the policy layer and adapter-based at the implementation layer.

## Supported targets (planned)

| Target | Storage | AI / compute | Notes |
|--------|---------|--------------|-------|
| AWS | S3, RDS, Secrets Manager, KMS | ECS/EKS, Bedrock, private VPC endpoints | First-class |
| Microsoft Azure | Blob, Azure SQL, Key Vault | AKS, Azure OpenAI, Private Link | First-class |
| Google Cloud | GCS, Cloud SQL, Secret Manager, CMEK | GKE, Vertex AI, Private Google Access | First-class |
| Private cloud | Customer object store + DB | Customer GPU/CPU runners | Via standard adapters |
| OffshoreHelper managed | Our regions | Our controlled runners | Default for pilots |

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
    provider: aws | azure | gcp | private | managed
    region: string
    bucketOrContainer: string
    cmk: optional
  execution:
    provider: aws | azure | gcp | private | managed
    mode: public_endpoint | private_endpoint | customer_vpc
    modelGateway: string
  network:
    allowPublicModelApis: boolean
    egressAllowlist: [hosts]
```

Storage and execution providers **may differ**.

## Connection flow

1. Founder selects provider in web control plane.  
2. Connect via OIDC / IAM role assumption (preferred) or short-lived credentials.  
3. OffshoreHelper validates permissions with least privilege (write artifacts, invoke model gateway, read secrets).  
4. Health check job runs in the customer environment.  
5. Policy becomes available to orchestrator.  

Never store long-lived access keys in application DB without vault wrapping.

## Private vs public generative AI

| Mode | Meaning |
|------|---------|
| Public cloud GenAI | Use provider APIs (OpenAI-compatible, Bedrock, Azure OpenAI, Vertex) under customer account |
| Private GenAI | Models hosted in customer VPC / dedicated endpoints; no training on customer data |
| Hybrid | Embeddings private; generation public — only if policy allows |

“Our genic area” / managed GenAI is an optional OffshoreHelper-hosted plane for customers who do not bring their own — still subject to PII firewall and audit.

## Scaling story

- **Small projects**: managed cloud, shared runners, elevated security  
- **Large enterprises**: dedicated deployment, CMK, private endpoints, custom MCP allowlists  

## Agent implementation guidance

- One `CloudAdapter` interface: `putArtifact`, `getSecret`, `invokeModel`, `ensureNetworkPolicy`  
- Per-provider adapters under `integrations/cloud/{aws,azure,gcp,private}`  
- Integration tests with localstack / emulators where possible  
- Document IAM permission matrices per provider in this folder as they are added  

Related: [SECURITY.md](../security/SECURITY.md), [MODEL_PLATFORM_CONFIG.md](../ai/MODEL_PLATFORM_CONFIG.md).

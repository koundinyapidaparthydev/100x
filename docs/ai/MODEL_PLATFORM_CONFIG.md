# Model & Platform Configuration

Founders, employers, and (where allowed) employees customize **which model**, **which platform/kit**, and **whether code may be overridden**.

## Precedence

```text
Founder lock ≥ Employer/project policy ≥ Employee preference ≥ Ticket override
```

If founder sets `lockModels=true`, lower roles cannot switch providers.

## Model selection

Configurable fields:

| Field | Description |
|-------|-------------|
| `provider` | `auto`, `openai`, `anthropic`, `openrouter`, or OpenRouter aliases (`deepseek`, `kimi`, `qwen`, `grok`, `nemotron`). Stored labels like `azure_openai` / `bedrock` are policy-only until wired. |
| `modelId` | Specific model string, or `auto` for the provider default |
| `temperature` / decoding params | Bounded by org max |
| `endpoint` | Private or regional endpoint URL |
| `dataRetention` | `none` preferred for enterprise |

Catalog is org-managed so employees pick only from approved models.

### Runtime (backend env)

Live drafts use keys on the API process (never commit secrets):

| Env | Provider |
|-----|----------|
| `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`) | OpenAI Chat Completions |
| `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_BASE_URL`) | Anthropic Messages |
| `OPENROUTER_API_KEY` (+ optional `OPENROUTER_BASE_URL`) | OpenRouter (DeepSeek, Kimi, Qwen, Grok, Nemotron, …) |

`provider: auto` selects the **first configured** key in order: OpenAI → Anthropic → OpenRouter. If none are set, the sandbox runner returns canned drafts.

**Not customer-keyed here:** Cursor Composer, Cursor’s internal models, and other IDE-only runtimes. Those appear as *runtime adapter* labels (where humans continue work), not as 100x inference providers. Use OpenRouter (e.g. `x-ai/grok-3-mini`) when you need Grok via an API key.

## Platform / kit selection

“Platform” means where the agent operates on code and tools:

- Managed 100x runner
- Customer CI / agent VM
- Developer kit integrations (IDE agent kits, CLI runners)
- Future: desktop kit (not v1)

Policy example:

```yaml
platformPolicy:
  runtime: managed | customer_vm | employee_kit
  allowedToolPacks: [jira, repo_readonly, tests]
  network: private_only | allowlist
```

## Code override policy

Question customers ask: *Can AI change code in our kit?*

| Mode | Behavior |
|------|----------|
| `readonly` | AI may analyze; no writes |
| `branch_only` | AI may push to a named AI branch |
| `workspace_override` | AI may modify working tree in employee kit (explicit opt-in) |
| `forbid` | No code mutation |

`workspace_override` requires:

- Employer enablement
- Audit of every file touch
- Optional manager approval above risk score

## Public vs private GenAI area

- **Public**: approved vendor APIs
- **Private / customer GenAI area**: inference stays in customer network
- **Managed GenAI area**: 100x-hosted private-ish plane for smaller customers

See [CLOUD_CUSTOMIZATION.md](../integrations/CLOUD_CUSTOMIZATION.md).

## Employee customization

Employees may set personal defaults **within** org allowlists:

- Preferred approved model
- Notification prefs when AI draft ready
- Local kit path / override preference if permitted

They cannot disable PII firewall or lower security level below org minimum.

## UX surfaces

- Web: full policy editor, catalogs, locks  
- Mobile: quick model profile picker only if unlocked; otherwise read-only display  

## Custom models & skills (learning layer)

Runtime model selection (this doc) is separate from **training** custom models and publishing skills. Those products consume **Solutions** (approved + merged call sets) only — see [SOLUTIONS.md](SOLUTIONS.md) and [MODELS_AND_SKILLS.md](MODELS_AND_SKILLS.md).

Related: [AI_DELEGATION.md](AI_DELEGATION.md), [../security/SECURITY.md](../security/SECURITY.md).

# AI Delegation Pipeline

## Purpose

Run AI **before** human assignment so a configurable fraction of the ticket is already advanced — typically **10%, 20%, or 30%** of the work — then hand off to an engineer (offshore or onshore).

## Decision: AI-first or human-first

Sources of truth (highest wins unless org lock):

1. Org default policy  
2. Project policy  
3. Manager mobile swipe / web toggle on the ticket  
4. Automation rules (e.g. label `ai-first`, issue type Bug, etc.)  

If `aiFirst=false`, ticket routes to humans as today; AI may still be available later as assist-only.

## Completion target

`targetCompletionPercent` is a **policy estimate**, not a guarantee.

Examples of what “20% done” may mean:

- Clarified acceptance criteria + implementation plan  
- Root-cause hypothesis for a bug + failing test sketch  
- Draft patch in a branch / patch file without merge  
- Dependency map and risk notes  

The runner stops when **any** of these hit:

- Target completion heuristic satisfied  
- Token budget exhausted  
- Wall-clock timeout  
- Policy risk (PII block, tool deny)  
- Explicit manager cancel  

## Token budgets

Adjustable at org / project / ticket levels:

```yaml
tokenBudget:
  maxInputTokens: number
  maxOutputTokens: number
  maxTotalTokens: number
  maxCostUsd: number        # optional
  onExhaustion: stop | notify_manager | escalate_human
```

Orchestrator records actual usage on the ticket and in audit logs.

## Job lifecycle

```text
queued → sanitizing → enriching_mcp → running → packaging → attaching → ready_for_human
                 ↘ blocked_pii
                 ↘ failed
                 ↘ cancelled
```

## Human hand-off package

When AI finishes, attach:

- Summary of what was done / assumed  
- Remaining work checklist  
- Artifacts (diff, docs, test stubs)  
- Model / cloud / tokens used  
- PII redaction report (counts, not raw values)  

Assignee continues in their kit. Whether AI may have **overridden code** in that kit is controlled by [MODEL_PLATFORM_CONFIG.md](MODEL_PLATFORM_CONFIG.md).

## Quality & safety loops

Optional later phases:

- Static checks on AI patches before attach  
- Bug-finding pass on existing platform code (policy-gated)  
- Flow optimization suggestions (non-mutating by default)  

These never bypass security layers.

## Metrics to track

- % tickets AI-first  
- Median tokens / ticket  
- Human time saved (estimated)  
- Revert / rejection rate of AI artifacts  
- PII block rate  

Related: [MODEL_PLATFORM_CONFIG.md](MODEL_PLATFORM_CONFIG.md), [../ARCHITECTURE.md](../ARCHITECTURE.md).

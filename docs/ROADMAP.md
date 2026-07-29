# Roadmap

Build step by step. Foundation before scale.

## Phase 0 — Documentation & contracts (current)

- Vision, architecture, security, PII, AI, integrations, platforms docs  
- Agent handoff packs  
- Shared schema sketches  

## Phase 1 — Foundation spine

- Auth, tenants, RBAC  
- Policy store  
- Audit log  
- Security layers 1–4 wired; layer 5 stubbed as mandatory interface  
- See [FOUNDATION.md](FOUNDATION.md)  

## Phase 2 — Jira sync + web admin MVP

- Connect Jira project  
- WorkItem sync + write-back comments  
- Web: connect board, basic policies  

## Phase 3 — PII firewall + AI job MVP

- Detectors + redaction  
- Token-budgeted AI runner (sandbox + one real provider)  
- Artifacts attached to Jira  

## Phase 4 — Mobile triage

- Swipe AI-first / human-first  
- Push when draft ready / PII blocked  

## Phase 5 — Multi-cloud & private GenAI

- AWS / Azure / GCP adapters  
- Customer VPC execution  
- CMK options  

## Phase 6 — MCP expansion

- Repo read-only, docs, CI packs  
- Controlled write tools (PR/branch)  

## Phase 7 — Optimization & trust

- Bug-finding / flow-optimization agents (policy-gated)  
- Enterprise security level 6 hardening  
- Compliance exports, pen-test remediation  

## Phase 8 — Scale & later surfaces

- Large-org dedicated deployments  
- Additional boards (Canvas, etc.)  
- Desktop app exploration (explicitly later)  

## Parallelization hint

Phases 2–4 can partially overlap once Phase 1 contracts are stable. Cloud adapters (Phase 5) can start with interface stubs during Phase 3.

See [agents/AGENT_HANDOFF.md](agents/AGENT_HANDOFF.md) for workstream splits.

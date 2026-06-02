# Install And Use

This guide explains how to use the skills in this folder with different coding agents.

## 1. What these skills are

Each skill is a markdown file containing:
- purpose
- when to use it
- required inputs
- strict rules and guardrails
- step-by-step process
- references to supporting docs or commands

## 2. Agent-agnostic usage model

These skills do not depend on a single agent product.

You can use them in three common ways:

### A. Manual prompt attachment
- open the relevant skill file
- paste it into the chat with your coding agent
- ask the agent to follow that skill while doing the task

### B. Local skills folder import
- if your agent supports local skill folders, point it at this `skills/` directory
- map the files into the agent's skill discovery mechanism

### C. Team knowledge base
- store the skill files in a shared engineering handbook or wiki
- have agents and developers reference them as standard operating guidance

## 3. Requirements for effective use

The agent should be able to:
- read markdown files
- inspect repo files
- follow step-by-step instructions
- keep the listed guardrails

Optional but useful:
- terminal access
- git access
- web access for documentation lookup

## 4. Recommended install approaches by agent type

### OpenCode / local skill-aware agents
- copy or symlink the files into the agent's project-local skills location if needed
- or leave them here and reference them directly if the agent can read repo files

### Claude-style agents
- paste the relevant skill into the prompt
- or convert the file into the agent's local skill format if supported

### GPT-style coding agents
- attach or paste the relevant skill content at the start of the task

### Local models / offline agents
- keep the skills in the repo
- load them into the model context manually or through your local orchestration tool

## 5. Recommended usage pattern

1. Choose the smallest relevant skill
2. Load the supporting references if needed
3. Tell the agent exactly which skill to follow
4. Ask the agent to keep the constraints and verification steps
5. For any meaningful OpenCode task, require `skills/hermes-handoff-after-opencode-task.md` before the session ends

Example:

```text
Use skills/nginx-reverse-proxy.md and skills/deploy-verify-rollback.md.
Apply those rules while updating this application's nginx routing and deploy checks.
Before ending, use skills/hermes-handoff-after-opencode-task.md and produce the Hermes Update Pack.
```

## 5.1 Mandatory Hermes handoff rule

OpenCode is project-local. Hermes is the portfolio/project memory and knowledge-graph layer.

Therefore, every OpenCode session that changes or meaningfully investigates code, docs, deployment, auth, database, architecture, risks, or decisions must end with a **Hermes Update Pack**.

Use:

```text
Use skills/hermes-handoff-after-opencode-task.md.
Produce the Hermes Update Pack for this session. Do not include secrets.
```

Then send/paste that pack to Hermes so Hermes can update:

- project overview
- technical architecture
- deployment/CI-CD notes
- risk/open-question notes
- decision log
- EXIT/handover state
- skill/process notes

## 6. How to create new skills later

Use:
- `support/skill-template.md`

Keep new skills:
- concrete
- operational
- linked to real recurring work
- validated against actual repository practice

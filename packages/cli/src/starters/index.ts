/**
 * Starter recipes for Context Nest vaults.
 *
 * Each starter provides scaffolding (nodes, packs) and a post-init prompt
 * that Claude reads from stdout to interactively generate a tailored CLAUDE.md.
 */

import { getPostInitPrompt } from "./claude-md-base.js";
import type { PostInitPrompt } from "./claude-md-base.js";

export interface StarterNode {
  /** Relative path without .md, e.g. "nodes/architecture-overview" */
  path: string;
  /** Full markdown content including frontmatter */
  content: string;
}

export interface StarterPack {
  /** Pack filename without extension */
  id: string;
  /** YAML content for the pack file */
  content: string;
}

export interface Starter {
  id: string;
  name: string;
  description: string;
  nodes: StarterNode[];
  packs: StarterPack[];
  getPrompt(): PostInitPrompt;
}

// ─── Developer Starter ─────────────────────────────────────────────────────────

const developer: Starter = {
  id: "developer",
  name: "Software Engineering",
  description: "Architecture docs, API references, and dev setup for engineering teams",
  nodes: [
    {
      path: "nodes/architecture-overview",
      content: `---
title: "Architecture Overview"
type: document
tags: ["#engineering", "#architecture"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# Architecture Overview

## System Components

Describe the major components of your system here.

## Data Flow

How does data move through the system?

## Infrastructure

Hosting, deployment, and infrastructure details.

## Key Decisions

Document significant architectural decisions and their rationale.
`,
    },
    {
      path: "nodes/api-reference",
      content: `---
title: "API Reference"
type: reference
tags: ["#engineering", "#api"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# API Reference

## Endpoints

Document your API endpoints, request/response formats, and authentication.

## Authentication

How do clients authenticate?

## Rate Limits

Rate limiting policy and quotas.

## Error Codes

Standard error response format and codes.
`,
    },
    {
      path: "nodes/development-setup",
      content: `---
title: "Development Setup"
type: document
tags: ["#engineering", "#onboarding"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# Development Setup

## Prerequisites

What needs to be installed before starting.

## Getting Started

Step-by-step setup instructions.

## Environment Variables

Required configuration and where to get values.

## Running Tests

How to run the test suite.
`,
    },
  ],
  packs: [
    {
      id: "engineering-essentials",
      content: `id: engineering-essentials
label: Engineering Essentials
description: Core engineering docs — architecture, API, and dev setup
includes:
  - nodes/architecture-overview
  - nodes/api-reference
  - nodes/development-setup
agent_instructions: >
  Use these documents to understand the system architecture, API surface,
  and development environment. Reference them when answering engineering
  questions or making technical decisions.
`,
    },
  ],
  getPrompt() {
    return getPostInitPrompt(this.id, this.description);
  },
};

// ─── Executive Starter ──────────────────────────────────────────────────────────

const executive: Starter = {
  id: "executive",
  name: "Strategic Leadership",
  description: "Strategic vision, market analysis, and decision records for leadership teams",
  nodes: [
    {
      path: "nodes/strategic-vision",
      content: `---
title: "Strategic Vision"
type: document
tags: ["#strategy", "#leadership"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# Strategic Vision

## Mission

Why does this organization exist?

## Vision

Where are we going in 3-5 years?

## Strategic Priorities

The 3-5 things that matter most right now.

## Key Metrics

How we measure progress against the vision.
`,
    },
    {
      path: "nodes/market-landscape",
      content: `---
title: "Market Landscape"
type: document
tags: ["#strategy", "#market"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# Market Landscape

## Market Size & Trends

Total addressable market and growth trajectory.

## Competitive Analysis

Key competitors, their strengths, weaknesses, and positioning.

## Our Differentiation

What makes us defensible and hard to replicate.

## Threats & Opportunities

External factors that could change the landscape.
`,
    },
    {
      path: "nodes/decision-log",
      content: `---
title: "Decision Log"
type: document
tags: ["#strategy", "#decisions"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# Decision Log

Track significant strategic decisions, their context, and outcomes.

## Template

| Date | Decision | Context | Alternatives Considered | Outcome |
|------|----------|---------|------------------------|---------|
| YYYY-MM-DD | What was decided | Why it came up | What else was on the table | Result |
`,
    },
  ],
  packs: [
    {
      id: "strategy-essentials",
      content: `id: strategy-essentials
label: Strategy Essentials
description: Strategic vision, market analysis, and decision records
includes:
  - nodes/strategic-vision
  - nodes/market-landscape
  - nodes/decision-log
agent_instructions: >
  Use these documents to understand the organization's strategic direction,
  competitive positioning, and key decisions. Reference them when helping
  with strategic planning, board prep, or investor communications.
`,
    },
  ],
  getPrompt() {
    return getPostInitPrompt(this.id, this.description);
  },
};

// ─── Analyst Starter ────────────────────────────────────────────────────────────

const analyst: Starter = {
  id: "analyst",
  name: "Research & Investigation",
  description: "Case files, source tracking, and analytical methodology for research and OSINT",
  nodes: [
    {
      path: "nodes/case-file-template",
      content: `---
title: "Case File Template"
type: document
tags: ["#investigation", "#template"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# Case File: [Case Name]

## Summary

Brief overview of the investigation subject and objectives.

## Key Findings

Numbered findings with evidence references.

## Timeline

Chronological sequence of relevant events.

## Evidence

Links to source documents, screenshots, and data exports.

## Analysis

Analytical assessment and confidence levels.

## Recommendations

Recommended next steps or actions.
`,
    },
    {
      path: "nodes/source-registry",
      content: `---
title: "Source Registry"
type: reference
tags: ["#investigation", "#sources"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# Source Registry

Track all sources used in investigations, their reliability, and access methods.

## Source Template

| Source | Type | Reliability | Access Method | Last Verified | Notes |
|--------|------|-------------|---------------|---------------|-------|
| Name | OSINT/HUMINT/SIGINT | A-F | URL/API/Manual | Date | |

## Reliability Scale

- **A** — Confirmed, multiple independent sources
- **B** — Probably reliable, corroborated
- **C** — Possibly reliable, single source
- **D** — Not usually reliable
- **E** — Unreliable
- **F** — Cannot be judged
`,
    },
    {
      path: "nodes/methodology",
      content: `---
title: "Analytical Methodology"
type: document
tags: ["#investigation", "#methodology"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# Analytical Methodology

## Collection Plan

What data to collect, from which sources, using which tools.

## Analysis Framework

Structured analytical techniques in use:
- Analysis of Competing Hypotheses (ACH)
- Link analysis
- Timeline analysis
- Pattern of life analysis

## Quality Controls

- Source verification requirements
- Confidence level standards
- Peer review process
- Attribution standards

## Operational Security

Guidelines for protecting sources and methods.
`,
    },
  ],
  packs: [
    {
      id: "investigation-essentials",
      content: `id: investigation-essentials
label: Investigation Essentials
description: Case files, source tracking, and analytical methodology
includes:
  - nodes/case-file-template
  - nodes/source-registry
  - nodes/methodology
agent_instructions: >
  Use these documents for investigation work. Always track source
  reliability, maintain evidence chains, and follow the analytical
  methodology. Cite sources by document path and note confidence levels.
`,
    },
  ],
  getPrompt() {
    return getPostInitPrompt(this.id, this.description);
  },
};

// ─── Team Starter ───────────────────────────────────────────────────────────────

const team: Starter = {
  id: "team",
  name: "Team Knowledge Base",
  description: "Team handbook, onboarding guide, and operational runbooks for shared knowledge",
  nodes: [
    {
      path: "nodes/team-handbook",
      content: `---
title: "Team Handbook"
type: document
tags: ["#team", "#processes"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# Team Handbook

## Who We Are

Team mission, members, and roles.

## How We Work

Communication norms, meeting cadence, and decision-making process.

## Tools & Access

Tools the team uses and how to get access.

## Rituals

Standups, retros, planning sessions, and other recurring activities.
`,
    },
    {
      path: "nodes/onboarding-guide",
      content: `---
title: "Onboarding Guide"
type: document
tags: ["#team", "#onboarding"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# Onboarding Guide

## Week 1

What a new team member should accomplish in their first week.

## Key Contacts

Who to talk to for what.

## Access & Accounts

Systems and accounts needed, and how to request them.

## First Tasks

Starter tasks to build context and confidence.
`,
    },
    {
      path: "nodes/runbook",
      content: `---
title: "Operational Runbook"
type: document
tags: ["#team", "#operations"]
status: draft
version: 1
created_at: "${new Date().toISOString()}"
---

# Operational Runbook

## Common Procedures

Step-by-step guides for recurring operational tasks.

## Incident Response

What to do when things break.

## Escalation Path

Who to contact at each severity level.

## Monitoring & Alerts

What's monitored, where to look, and what the alerts mean.
`,
    },
  ],
  packs: [
    {
      id: "team-essentials",
      content: `id: team-essentials
label: Team Essentials
description: Team handbook, onboarding, and operational runbooks
includes:
  - nodes/team-handbook
  - nodes/onboarding-guide
  - nodes/runbook
agent_instructions: >
  Use these documents to understand team processes, help onboard new
  members, and reference operational procedures. Keep information current
  and flag stale content when noticed.
`,
    },
  ],
  getPrompt() {
    return getPostInitPrompt(this.id, this.description);
  },
};

// ─── Registry ───────────────────────────────────────────────────────────────────

export const starters = new Map<string, Starter>([
  ["developer", developer],
  ["executive", executive],
  ["analyst", analyst],
  ["team", team],
]);

export function getStarter(id: string): Starter | undefined {
  return starters.get(id);
}

export function listStarters(): Starter[] {
  return Array.from(starters.values());
}

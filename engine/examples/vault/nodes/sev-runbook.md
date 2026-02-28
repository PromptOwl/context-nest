---
id: ulid:01JCQM2K7X8PQR5TVWXYZ12345
title: "SEV Management Runbook"
type: document
owners:
  - team:sre
  - user:misha
scope: team
tags:
  - "#runbook"
  - "#sev"
  - "#oncall"
permissions:
  read:
    - team:sre
    - role:exec_view
  write:
    - user:misha
    - team:sre
  export:
    - role:compliance
    - role:exec
version: 3
created_at: "2025-10-15T14:30:00Z"
updated_at: "2025-10-28T21:00:00Z"
derived_from: []
checksum: "sha256:abc123def456789012345678901234567890123456789012345678901234"
metadata:
  word_count: 1250
  token_count: 1680
  last_reviewed: "2025-10-20"
  review_cycle_days: 90
---

# SEV Management Runbook

When a SEV (Service Event) is declared, follow these escalation procedures:

## Severity Levels

**SEV-1: Critical**
- Complete service outage
- Data loss occurring
- Security breach

**SEV-2: Major**
- Significant degradation
- Core features unavailable
- Multiple users affected

**SEV-3: Minor**
- Non-critical feature issues
- Workarounds available

## Escalation Procedure

1. **Declare SEV**
   - Post in #incidents Slack channel
   - Use format: `SEV-[level] [brief description]`

2. **Assemble Response Team**
   - IC (Incident Commander) leads response
   - Comms person handles stakeholder updates
   - Technical leads join war room

3. **Investigation**
   - Check recent deploys
   - Review metrics and logs
   - Identify root cause

4. **Mitigation**
   - Implement fix or rollback
   - Verify service recovery
   - Monitor for stability

5. **Post-Mortem**
   - Schedule blameless retrospective
   - Document timeline
   - Create action items

## Contact List

- On-call SRE: PagerDuty rotation
- Engineering VP: slack @eng-vp
- CTO: slack @cto (SEV-1 only)

## Tools

- Monitoring: Datadog
- Logs: Splunk
- Incident tracking: Jira

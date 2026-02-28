---
id: ulid:01JCQM2K7X8PQR5TVWXYZ12354
title: "Engineering Team Values"
type: document
owners:
  - team:engineering
  - user:misha
scope: org
tags:
  - "#values"
  - "#culture"
  - "#engineering"
  - "#internal"
permissions:
  read:
    - team:engineering
    - role:employee
    - role:candidate
  write:
    - team:engineering
  export:
    - role:hr
version: 2
created_at: "2025-05-01T00:00:00Z"
updated_at: "2025-09-15T14:00:00Z"
derived_from: []
checksum: "sha256:pqr678stu901234567890123456789012345678901234567890123456789"
metadata:
  word_count: 1100
  token_count: 1500
  last_reviewed: "2025-09-15"
  review_cycle_days: 180
---

# Engineering Team Values

## Our Mission

Build AI tools that empower people to work smarter, not harder. We create reliable, scalable systems that put user needs first.

## Core Values

### 1. User-Centric Development

**We build for real people, not abstractions.**

- Talk to users regularly
- Measure impact, not just features
- Solve problems, don't just ship code
- Prioritize usability over complexity

**Example**: Before building a new API endpoint, understand why users need it and what they'll do with it.

### 2. Technical Excellence

**We take pride in our craft.**

- Write code that's easy to read and maintain
- Test thoroughly (unit, integration, E2E)
- Document architectural decisions
- Refactor continuously, not in big bangs
- Learn from mistakes through blameless post-mortems

**Example**: Leave code better than you found it. If you touch a file, improve something.

### 3. Bias for Action

**We ship fast and iterate.**

- Start small, learn quickly
- Use feature flags for gradual rollouts
- Prototype before polishing
- "Done is better than perfect" (but done doesn't mean broken)
- Time-box investigations and spikes

**Example**: Launch an MVP with 80% of features rather than waiting for 100%.

### 4. Ownership and Accountability

**We own what we build, end to end.**

- You build it, you run it
- Monitor your services
- Fix your bugs promptly
- Own the on-call rotation
- Take responsibility for incidents

**Example**: When your service has an incident, lead the investigation and post-mortem.

### 5. Collaboration Over Ego

**The best idea wins, not the loudest voice.**

- Code review is learning, not gatekeeping
- Ask for help early and often
- Share knowledge through docs and talks
- Celebrate team wins over individual glory
- Disagree and commit

**Example**: If you disagree with a technical decision, speak up. Once decided, support the team.

### 6. Sustainable Pace

**We're building a marathon team, not sprinters.**

- No hero culture or burnout glorification
- Take time off and disconnect
- Respect work-life boundaries
- Automate toil work
- Say no to unrealistic deadlines

**Example**: If you're working nights and weekends regularly, something is wrong. Speak to your manager.

## How We Work

### Code Review Culture

- Review within 24 hours
- Be kind, be specific
- Ask questions, don't demand changes
- Approve when good enough, not perfect
- Focus on learning, not nitpicking

### Testing Philosophy

- Unit tests: Fast, focused, many
- Integration tests: Slower, realistic, selective
- E2E tests: Slowest, critical flows only
- Test behavior, not implementation
- Fix flaky tests immediately

### Deployment Practices

- Deploy daily (or more)
- Use feature flags for risk mitigation
- Monitor deployments actively
- Rollback fast when needed
- Always have a rollback plan

### Incident Response

- Mitigate first, investigate later
- Communicate early and often
- Blameless post-mortems
- Action items with owners and deadlines
- Share learnings organization-wide

## Communication

### Synchronous (Slack, meetings)

**Use for:**
- Urgent issues
- Brainstorming
- Quick clarifications
- Team bonding

**Tips:**
- Respect focus time (DND status)
- Use threads to organize discussions
- @mention sparingly

### Asynchronous (Docs, PRs, issues)

**Use for:**
- Design docs
- Code reviews
- Feature requests
- Non-urgent updates

**Tips:**
- Write clear context
- Link to related resources
- Be explicit about what you need

## Growth and Learning

### Career Development

- Own your growth plan
- Regular 1:1s with manager
- Stretch projects and mentorship
- Conference attendance budget
- 20% time for learning and exploration

### Technical Skills

We value T-shaped engineers:
- **Deep expertise** in one or two areas
- **Broad knowledge** across the stack
- **Continuous learning** of new technologies

**Encouraged learning:**
- Pair programming
- Internal tech talks
- External conferences
- Side projects
- Contributing to open source

## Meetings

### We minimize but don't eliminate meetings

**Standing meetings:**
- Daily standup (15 min, async option available)
- Sprint planning (1 hour)
- Retrospective (45 min)
- Demo day (30 min)

**Ad-hoc meetings:**
- Always have an agenda
- Start and end on time
- Record for those who can't attend
- Default to 25 or 50 minutes (not 30/60)

## Remote-First Culture

We're distributed by default:
- Async-first communication
- Document decisions
- Overlap hours for collaboration (10am-2pm PT)
- Optional co-working days
- Annual team offsite

## Success Metrics

We measure ourselves by:

**Team Health:**
- Developer satisfaction scores
- Time to first commit (onboarding)
- On-call load and incidents
- Code review turnaround time

**Technical Quality:**
- Test coverage and CI reliability
- Deployment frequency
- Mean time to recovery (MTTR)
- Service uptime (SLA compliance)

**Business Impact:**
- User satisfaction (NPS, CSAT)
- Feature adoption rates
- API success rates
- Performance metrics (latency, throughput)

## Living Document

These values evolve as we grow. Every engineer can propose changes through PRs to this document.

**Last updated**: September 2025
**Next review**: March 2026
**Owner**: Engineering Leadership

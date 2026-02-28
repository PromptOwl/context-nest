---
id: ulid:01JCQM2K7X8PQR5TVWXYZ12353
title: "Production Deployment Workflow"
type: document
owners:
  - team:sre
  - team:engineering
scope: team
tags:
  - "#workflow"
  - "#deployment"
  - "#cicd"
  - "#guide"
permissions:
  read:
    - team:engineering
    - team:sre
    - role:developer
  write:
    - team:sre
  export:
    - role:compliance
version: 5
created_at: "2025-08-01T12:00:00Z"
updated_at: "2025-10-29T10:30:00Z"
derived_from: []
checksum: "sha256:mno345pqr678901234567890123456789012345678901234567890123456"
metadata:
  word_count: 1500
  token_count: 2000
  last_reviewed: "2025-10-29"
  review_cycle_days: 30
---

# Production Deployment Workflow

## Overview

This document describes our CI/CD pipeline and deployment process for PromptOwl production environments.

## Environments

- **Development** (`dev`): Local development
- **Staging** (`staging`): Pre-production testing
- **Production** (`prod`): Live customer-facing environment

## Deployment Pipeline

### 1. Code Commit

```bash
# Feature branch
git checkout -b feature/new-llm-integration
# ... make changes ...
git add .
git commit -m "feat: Add support for Gemini 2.0"
git push origin feature/new-llm-integration
```

### 2. Pull Request

Create PR with:
- **Title**: Clear, concise description
- **Description**: What changed and why
- **Testing**: Steps to verify changes
- **Screenshots**: For UI changes
- **Breaking changes**: Clearly marked

**Required checks:**
- ✅ All tests pass
- ✅ Linting passes
- ✅ Build succeeds
- ✅ Security scan clean
- ✅ Code coverage maintained

### 3. Code Review

**Reviewers**: Minimum 2 approvals required
- 1 from code owner (CODEOWNERS file)
- 1 from any team member

**Review checklist:**
- Code quality and readability
- Test coverage adequate
- Security considerations
- Performance impact
- Documentation updated

### 4. Merge to Main

On merge to `main` branch:
1. **Automated tests** run again
2. **Build** creates Docker image
3. **Tag** with version (`v1.2.3`)
4. **Push** to container registry
5. **Deploy to staging** automatically

### 5. Staging Validation

**Automated tests:**
- Integration tests
- E2E tests
- Performance tests
- Security scans

**Manual validation:**
- Smoke tests of critical flows
- Check deployment logs
- Verify metrics dashboard

**Staging checklist:**
- [ ] All services healthy
- [ ] Database migrations applied
- [ ] API endpoints responding
- [ ] No error spikes in logs
- [ ] Response times normal

### 6. Production Deployment

**Deployment window:**
- Weekdays: 10am-4pm PT (avoid peak traffic)
- Fridays: Before 2pm PT only
- Never during: Holidays, major launches, high-traffic events

**Deployment types:**

#### Blue-Green Deployment (Default)
```bash
# Deploy to green environment
kubectl apply -f k8s/prod/green/

# Run smoke tests against green
npm run test:smoke -- --env=green

# Switch traffic to green
kubectl patch service promptowl -p '{"spec":{"selector":{"version":"green"}}}'

# Monitor for 15 minutes
# If issues: kubectl patch service promptowl -p '{"spec":{"selector":{"version":"blue"}}}'
```

#### Canary Deployment (High-risk changes)
```bash
# Deploy canary with 5% traffic
kubectl apply -f k8s/prod/canary/

# Monitor metrics for 1 hour:
# - Error rates
# - Response times
# - User reports

# If metrics good: Increase to 25%, 50%, 100%
# If metrics bad: Rollback immediately
```

### 7. Post-Deployment

**Monitoring (30 minutes):**
- [ ] Error rates < baseline
- [ ] Response times < baseline + 10%
- [ ] No spike in support tickets
- [ ] Database queries performing well
- [ ] Background jobs processing

**Verification:**
- [ ] Test critical user flows
- [ ] Check recent error logs
- [ ] Verify external integrations
- [ ] Confirm scheduled jobs running

**Communication:**
- Post in #deployments Slack channel
- Update status page if needed
- Notify support team of changes

### 8. Rollback Procedure

If issues detected:

```bash
# Immediate rollback (< 5 minutes)
kubectl rollout undo deployment/promptowl

# Or specific version
kubectl rollout undo deployment/promptowl --to-revision=42

# Verify rollback
kubectl rollout status deployment/promptowl

# Check services healthy
kubectl get pods -l app=promptowl
```

**Rollback triggers:**
- Error rate > 1% increase
- Response time > 2x baseline
- Critical feature broken
- Data corruption detected
- Security vulnerability exposed

## Database Migrations

**Forward-compatible migrations only:**
1. Add new columns (nullable or with defaults)
2. Create new tables
3. Deploy application code
4. Backfill data if needed
5. Remove old columns in next release

**Never:**
- Rename columns in same deploy as code change
- Drop tables without deprecation period
- Change column types without compatibility layer

## Feature Flags

Use LaunchDarkly for gradual rollouts:

```typescript
// Enable for 10% of users
if (await featureFlags.isEnabled('new-llm-model', userId)) {
  return useGemini2();
} else {
  return useGemini1();
}
```

**Rollout strategy:**
1. Internal users only (1 day)
2. 5% of users (1 day)
3. 25% of users (2 days)
4. 50% of users (2 days)
5. 100% of users
6. Remove flag after 2 weeks

## Emergency Hotfix

For critical production issues:

1. Create hotfix branch from `main`
2. Implement minimal fix
3. Fast-track review (1 approval)
4. Deploy immediately to prod
5. Create incident post-mortem

## Tools

- **CI/CD**: GitHub Actions
- **Container Registry**: AWS ECR
- **Orchestration**: Kubernetes (EKS)
- **Monitoring**: Datadog
- **Feature Flags**: LaunchDarkly
- **Secrets**: AWS Secrets Manager

## Deployment Checklist

Before deploying:
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Feature flags configured
- [ ] Monitoring alerts active
- [ ] On-call engineer identified
- [ ] Deployment window appropriate

## Contacts

- **On-call SRE**: PagerDuty
- **Engineering Lead**: @eng-lead in Slack
- **Platform Team**: #platform channel
- **Deployment Issues**: #incidents channel

---
id: ulid:01JCQM2K7X8PQR5TVWXYZ12352
title: "Data Retention and Deletion Policy"
type: policy
owners:
  - team:legal
  - team:security
scope: confidential
tags:
  - "#policy"
  - "#compliance"
  - "#gdpr"
  - "#privacy"
permissions:
  read:
    - team:legal
    - team:security
    - team:engineering
    - role:compliance
    - role:exec
  write:
    - team:legal
  export:
    - role:compliance
    - role:audit
version: 4
created_at: "2024-06-01T00:00:00Z"
updated_at: "2025-10-15T16:45:00Z"
derived_from: []
checksum: "sha256:jkl012mno345678901234567890123456789012345678901234567890123"
metadata:
  word_count: 1800
  token_count: 2400
  last_reviewed: "2025-10-15"
  review_cycle_days: 180
  compliance_frameworks:
    - GDPR
    - CCPA
    - SOC2
---

# Data Retention and Deletion Policy

## Purpose

This policy defines how PromptOwl collects, stores, retains, and deletes user data in compliance with privacy regulations (GDPR, CCPA) and security best practices.

## Scope

Applies to all:
- User account data
- Conversation histories
- Generated artifacts
- Analytics and logs
- Backup systems

## Retention Periods

### Active User Data
- **User profiles**: Retained while account active + 30 days after deletion request
- **Conversations**: Retained for 2 years or until user deletion request
- **Artifacts**: Retained for 2 years or until user deletion request
- **API keys**: Retained while active + 90 days after revocation

### Inactive Accounts
- Accounts with no activity for 3 years are flagged for deletion
- User notified 30 days before deletion
- Data deleted if no response

### System Logs
- **Application logs**: 90 days
- **Security logs**: 1 year (SOC2 requirement)
- **Audit logs**: 7 years (compliance requirement)
- **Access logs**: 90 days

### Analytics Data
- **Aggregated metrics**: Retained indefinitely (anonymized)
- **Individual usage data**: 2 years
- **A/B test data**: 1 year after test conclusion

## Data Deletion Process

### User-Initiated Deletion
1. User submits deletion request via Settings or email
2. Account marked for deletion (30-day grace period)
3. User can cancel during grace period
4. After 30 days:
   - All conversations deleted
   - All artifacts deleted
   - API keys revoked
   - User profile anonymized (email becomes `deleted-user-[hash]@deleted.local`)
   - Analytics data anonymized

### Automated Deletion
- Scheduled jobs run daily to delete expired data
- Hard deletes remove data from:
  - Primary database (MongoDB)
  - Vector store (Qdrant)
  - Object storage (S3)
  - CDN caches
- Verification logs created for audit trail

### Backup Deletion
- Backups retained for 90 days
- Deleted data purged from backups after 90 days
- User notified that backup purge may take up to 90 days

## Right to Data Portability

Users can request data export:
- Account profile (JSON)
- All conversations (JSON)
- All artifacts (ZIP archive)
- Usage history (CSV)

Export delivered within 30 days via secure download link (expires in 7 days).

## Right to Be Forgotten

PromptOwl honors GDPR "Right to Erasure" requests:
1. User submits request via privacy@promptowl.ai
2. Identity verification required
3. Data deletion completed within 30 days
4. Confirmation email sent to user
5. Exceptions:
   - Legal hold data
   - Fraud prevention records (90 days)
   - Financial records (7 years tax requirement)

## Data Minimization

Only collect data necessary for:
- Service delivery
- Security and fraud prevention
- Legal compliance
- Product improvement (with consent)

## Anonymous Data

Aggregated, anonymized analytics data:
- Not subject to deletion requests (cannot identify individuals)
- Used for product improvement
- May be shared with partners in aggregate form

## Third-Party Data

Data shared with processors (OpenAI, Anthropic, etc.):
- Covered by Data Processing Agreements (DPA)
- Processors must delete data per our instructions
- Regular audits verify processor compliance

## Enforcement

- **Data Protection Officer**: monitors compliance
- **Engineering**: implements technical controls
- **Quarterly audits**: verify deletion processes
- **Annual review**: update policy as needed

## Exceptions

Data retention may be extended for:
- Active legal proceedings
- Regulatory investigations
- Security incident response
- Fraud prevention

Legal team must approve retention extensions in writing.

## Contact

Questions about this policy:
- Email: privacy@promptowl.ai
- DPO: dpo@promptowl.ai
- Legal: legal@promptowl.ai

## Version History

- v4 (2025-10-15): Updated retention periods for artifacts
- v3 (2025-06-01): Added CCPA compliance provisions
- v2 (2024-12-15): Clarified backup deletion process
- v1 (2024-06-01): Initial policy

# Specification: Permission Checks

## Purpose
Ensure that context resolution respects read/write/export permissions based on actor principals and node metadata.

## Principles
1. **Default Deny**: If no explicit permission, access is denied
2. **Principal Matching**: Allow if actor has ANY matching principal in the allowed set
3. **Operation-Specific**: Different operations (read, write, export) have separate permission checks
4. **Audit Trail**: Every permission check is logged with actor, resource, and decision

---

## Example 1: Basic Read Permission - Allowed

### Context
Node `sev-runbook.md`:
```yaml
permissions:
  read: ["team:sre", "role:exec_view"]
  write: ["user:misha"]
```

Actor: `agent:web1` with principals `["team:sre", "agent:web1"]`

### Action
```bash
ctx resolve "[[SEV Runbook]]" --actor agent:web1
```

### Expected Result
✅ **Allowed**
- Actor has `team:sre` which matches allowed `read` principals
- Bundle includes `sev-runbook.md`

---

## Example 2: Basic Read Permission - Denied

### Context
Node `sev-runbook.md`:
```yaml
permissions:
  read: ["team:sre", "role:exec_view"]
```

Actor: `agent:web2` with principals `["team:engineering", "agent:web2"]`

### Action
```bash
ctx resolve "[[SEV Runbook]]" --actor agent:web2
```

### Expected Result
❌ **Denied**
- Actor principals do not intersect with `read` permissions
- Error: `Permission denied: agent:web2 cannot read node ulid:01J…XY (SEV Runbook)`
- Bundle is empty

---

## Example 3: Multiple Nodes - Partial Access

### Context
Vault contains:
- `public-faq.md`: `permissions.read: ["*"]`
- `internal-guide.md`: `permissions.read: ["team:engineering"]`
- `restricted-doc.md`: `permissions.read: ["role:admin"]`

Actor: `user:alice` with principals `["user:alice", "team:engineering"]`

### Action
```bash
ctx resolve "#guide" --actor user:alice
```

### Expected Result
✅ **Partial Success**
- Bundle includes:
  - `public-faq.md` (wildcard allows all)
  - `internal-guide.md` (team match)
- Bundle excludes:
  - `restricted-doc.md` (no admin role)
- Warning: `1 node excluded due to insufficient permissions`

---

## Example 4: Write Permission Check

### Context
Node `glossary.md`:
```yaml
permissions:
  read: ["*"]
  write: ["team:content", "user:misha"]
```

Actor: `user:bob` with principals `["user:bob", "team:engineering"]`

### Action
```bash
ctx store glossary.md --actor user:bob
```

### Expected Result
❌ **Denied**
- Actor lacks `write` permission
- Error: `Permission denied: user:bob cannot write node ulid:01J…AB`
- No changes persisted

---

## Example 5: Export Permission - Default Deny

### Context
Node `financial-report.md`:
```yaml
permissions:
  read: ["team:finance", "role:exec"]
  # Note: No export permissions defined
```

Actor: `user:cfo` with principals `["user:cfo", "role:exec"]`

### Action
```bash
ctx export bundle-001.zip --actor user:cfo
```

### Expected Result
❌ **Denied**
- Export is default-deny unless explicitly granted
- Error: `Export denied: No export permissions defined for node ulid:01J…CD`

---

## Example 6: Export Permission - Explicit Allow

### Context
Node `public-whitepaper.md`:
```yaml
permissions:
  read: ["*"]
  export: ["*"]
```

Actor: `user:guest` with principals `["user:guest"]`

### Action
```bash
ctx export bundle-002.zip --actor user:guest
```

### Expected Result
✅ **Allowed**
- Explicit export permission via wildcard
- Bundle exported successfully

---

## Example 7: Role-Based Access

### Context
Node `compliance-checklist.md`:
```yaml
permissions:
  read: ["role:compliance", "role:admin"]
  export: ["role:compliance"]
```

Actor: `user:auditor` with principals `["user:auditor", "role:compliance"]`

### Action
```bash
ctx resolve "[[Compliance Checklist]]" --actor user:auditor
ctx export bundle-003.zip --actor user:auditor
```

### Expected Result
✅ **Both Allowed**
- Read: `role:compliance` matches
- Export: `role:compliance` matches
- Full access granted

---

## Example 8: Agent-Specific Permissions

### Context
Node `api-keys.md`:
```yaml
permissions:
  read: ["agent:trusted_bot", "user:misha"]
  export: ["user:misha"]  # Never exportable by agents
```

Actor: `agent:trusted_bot` with principals `["agent:trusted_bot"]`

### Action
```bash
ctx resolve "[[API Keys]]" --actor agent:trusted_bot
ctx export bundle-004.zip --actor agent:trusted_bot
```

### Expected Result
- Read: ✅ Allowed
- Export: ❌ Denied (agents can't export this node)

---

## Example 9: Hierarchical Team Permissions

### Context
Node `company-strategy.md`:
```yaml
permissions:
  read: ["team:leadership"]
```

Actor: `user:director` with principals `["user:director", "team:leadership", "team:engineering"]`

### Action
```bash
ctx resolve "[[Company Strategy]]" --actor user:director
```

### Expected Result
✅ **Allowed**
- `team:leadership` principal matches
- Multiple principals handled correctly (first match wins)

---

## Example 10: Wildcard Permissions

### Context
Node `public-roadmap.md`:
```yaml
permissions:
  read: ["*"]
  write: ["team:product"]
  export: ["*"]
```

Actor: `user:anonymous` with principals `["user:anonymous"]`

### Action
```bash
ctx resolve "[[Public Roadmap]]" --actor user:anonymous
```

### Expected Result
✅ **Allowed**
- Wildcard `*` matches any principal
- Read and export succeed
- Write would fail (specific team required)

---

## Example 11: Empty Permissions - Deny All

### Context
Node `draft-doc.md`:
```yaml
# No permissions field
```

Actor: `user:admin` with principals `["user:admin", "role:admin"]`

### Action
```bash
ctx resolve "[[Draft Doc]]" --actor user:admin
```

### Expected Result
❌ **Denied**
- Missing permissions = default deny
- Error: `Permission denied: No read permissions defined for node ulid:01J…EF`

---

## Example 12: Permission Check During Pack Resolution

### Context
Pack `pack:engineering.all`:
```yaml
query: "team:engineering"
```

Vault contains:
- `eng-public.md`: `permissions.read: ["*"]`
- `eng-internal.md`: `permissions.read: ["team:engineering"]`
- `eng-secret.md`: `permissions.read: ["role:admin"]`

Actor: `user:eng_member` with principals `["user:eng_member", "team:engineering"]`

### Action
```bash
ctx resolve "pack:engineering.all" --actor user:eng_member
```

### Expected Result
✅ **Partial Success**
- Bundle includes:
  - `eng-public.md` (wildcard)
  - `eng-internal.md` (team match)
- Bundle excludes:
  - `eng-secret.md` (needs admin role)
- Manifest includes: `nodes_excluded_by_permission: 1`

---

## PromptOwl Integration

### Example 13: NextAuth Session Mapping

### Context
PromptOwl user session:
```json
{
  "user": {
    "id": "usr_12345",
    "clientId": "client_acme",
    "role": "admin"
  }
}
```

Node in PromptOwl:
```yaml
permissions:
  read: ["team:client_acme", "role:admin"]
```

### Action
Server Action: `resolveContext("#docs", session)`

### Expected Result
✅ **Allowed**
- Session mapped to principals:
  - `user:usr_12345`
  - `team:client_acme`
  - `role:admin`
- Permission check passes via `team:client_acme` match

---

## Error Messages

### Example 14: Clear Error Messages

### Context
Actor `user:bob` attempts to access restricted node

### Expected Error Format
```json
{
  "error": "PERMISSION_DENIED",
  "message": "user:bob cannot read node ulid:01J…GH",
  "node_title": "Confidential Report",
  "required_principals": ["team:legal", "role:exec"],
  "actor_principals": ["user:bob", "team:engineering"]
}
```

---

## Audit Trail

### Example 15: Permission Check Logging

### Context
Every permission check generates audit entry

### Expected Audit Log Entry
```json
{
  "timestamp": "2025-10-28T20:15:42Z",
  "event": "permission_check",
  "operation": "read",
  "actor": "agent:web1",
  "actor_principals": ["agent:web1", "team:sre"],
  "resource": "ulid:01J…IJ",
  "resource_title": "SEV Runbook",
  "decision": "allow",
  "matched_principal": "team:sre"
}
```

---

## Implementation Notes

1. **Principal Resolution**:
   - CLI: Reads from `actors.yml` mapping
   - PromptOwl: Derives from NextAuth session
2. **Permission Evaluation**:
   - Check if `actor_principals ∩ allowed_principals ≠ ∅`
   - Wildcard `*` matches any non-empty principal set
3. **Audit**: Write to `audit.jsonl` (local) or MongoDB collection (PromptOwl)
4. **Performance**: Cache principal resolution per request

## Acceptance Criteria
- [ ] All 15 examples pass with file-based vault
- [ ] All 15 examples pass with MongoDB-backed vault (PromptOwl mode)
- [ ] NextAuth session correctly maps to principals
- [ ] Audit trail captures all permission decisions
- [ ] Error messages include required vs actual principals
- [ ] Wildcard permissions work correctly
- [ ] Default deny enforced when permissions missing

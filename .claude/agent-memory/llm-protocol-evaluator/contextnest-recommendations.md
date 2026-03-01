# ContextNest Protocol v0.1.0 -- Recommendations Tracker

Last updated: 2026-02-28 (post-Section 8 re-evaluation)

## Critical

| ID | Recommendation | Status | Notes |
|---|---|---|---|
| C1 | Add cryptographic signing (Ed25519) to hash chain entries | Open | Hash chains alone do not prevent full rewrite |
| C2 | Add content safety / prompt injection mitigation layer | Open | No sanitization before agent injection |
| C3 | Bind per-document chain_hash into checkpoint_hash | Open | Prevents isolated document history rewrite |

## High

| ID | Recommendation | Status | Notes |
|---|---|---|---|
| H1 | Define token budgeting semantics (max_tokens, pagination, depth_limit) | Open | Tag/folder queries are unbounded |
| H2 | Add URI canonicalization rules (path traversal prevention, case, encoding) | Open | Path traversal attack surface |
| H3 | Resolve rebuild-vs-integrity contradiction | Open | Rebuilt checkpoint chain != original chain |
| H4 | MUST verify for pinned resolution and provenance queries | Open | MAY is too weak for audit paths |
| H5 | Specify integer/timestamp serialization in hash inputs | Open | Interoperability risk |

## Medium

| ID | Recommendation | Status | Notes |
|---|---|---|---|
| M1 | Expand lifecycle (IN_REVIEW, DEPRECATED, ARCHIVED) | Open | |
| M2 | Add checkpoint_hash to context.yaml | Open | Quick integrity anchor for agents |
| M3 | Define cycle detection for link traversal | Open | Infinite loop risk |
| M4 | Define context_history.yaml compaction/sharding | Open | Unbounded growth problem |
| M5 | Publish governance interface contract in open spec | Open | Hollow standard risk |

## Low

| ID | Recommendation | Status | Notes |
|---|---|---|---|
| L1 | Define scoped federation allow-list format | Open | |
| L2 | Define error codes and resolution failure modes | Open | |
| L3 | Consider MCP binding instead of bespoke wire protocol | Open | |

## Previously Addressed

| Recommendation | Status | Section |
|---|---|---|
| Add SHA-256 content hashes to history entries | **Addressed** | Section 8 (hash chain) |
| Add hash-chain or signing for history/checkpoint integrity | **Partially addressed** | Section 8 (chain without signing) |

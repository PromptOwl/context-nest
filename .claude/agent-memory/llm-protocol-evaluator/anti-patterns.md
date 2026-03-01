# Recurring Security and Design Anti-Patterns in LLM Agent Protocol Proposals

## 1. Format Spec Labeled as Protocol
Proposals that define data-at-rest formats (file layouts, YAML schemas, URI schemes) but lack wire formats, handshake sequences, request/response schemas, and error codes. These cannot be independently implemented for interoperability.
- **First seen:** ContextNest Protocol Spec v0.1.0 (2026-02-28)

## 2. No Content Safety Layer for AI Injection
Protocols designed to feed content to AI agents that lack any sanitization, prompt injection detection, or AI-safety annotation mechanism. Content authored by humans goes directly into LLM context windows with no filtering.
- **First seen:** ContextNest Protocol Spec v0.1.0

## 3. Hash Chains Without Signing

Append-only logs with hash chains that detect partial tampering but lack cryptographic signatures. An attacker with write access can rewrite the entire chain from genesis with valid hashes. Tamper-evident against partial modification only; not tamper-proof against full rewrite.

- **First seen:** ContextNest Protocol Spec v0.1.0 (originally "Unsigned/Unverified History Files"; updated after Section 8 added hash chains without signing)
- **Fix:** Ed25519 signatures on each entry, bound to authenticated author identity

## 4. Missing Token Budgeting
Protocols that define context delivery to LLMs without addressing context window limits, token costs, or progressive disclosure. Resolution of broad queries (tag-based, folder-based) returns unbounded results.
- **First seen:** ContextNest Protocol Spec v0.1.0

## 5. Governance Model Withheld from Open Spec
Open format specs where the governance/approval model is kept proprietary, creating a "hollow standard" that cannot be fully implemented by third parties.
- **First seen:** ContextNest Protocol Spec v0.1.0

## 6. No URI Canonicalization Rules
Custom URI schemes without explicit normalization, validation, path traversal prevention, or escaping rules. Opens path traversal and injection vectors.
- **First seen:** ContextNest Protocol Spec v0.1.0

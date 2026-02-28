---
id: ulid:01JCQM2K7X8PQR5TVWXYZ12350
title: "API Integration Guide"
type: document
owners:
  - team:engineering
  - team:product
scope: public
tags:
  - "#guide"
  - "#api"
  - "#developer"
  - "#external"
permissions:
  read:
    - role:developer
    - role:partner
    - role:public
  write:
    - team:engineering
  export:
    - role:partner
    - role:compliance
version: 2
created_at: "2025-09-01T10:00:00Z"
updated_at: "2025-10-25T15:30:00Z"
derived_from: []
checksum: "sha256:def456abc789012345678901234567890123456789012345678901234567"
metadata:
  word_count: 2400
  token_count: 3200
  last_reviewed: "2025-10-25"
  review_cycle_days: 60
---

# API Integration Guide

Welcome to the PromptOwl API! This guide will help you integrate our AI platform into your applications.

## Authentication

All API requests require authentication via API key:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.promptowl.ai/v1/conversations
```

### Getting Your API Key

1. Log into your PromptOwl account
2. Navigate to Settings → API Keys
3. Click "Generate New Key"
4. Store securely (keys are only shown once)

## Core Endpoints

### Create Conversation

```http
POST /v1/conversations
Content-Type: application/json

{
  "prompt_id": "ulid:01ABC...",
  "user_message": "Analyze this data...",
  "stream": true
}
```

### List Artifacts

```http
GET /v1/artifacts?limit=20&offset=0
```

### Execute Workflow

```http
POST /v1/workflows/execute
Content-Type: application/json

{
  "workflow_id": "ulid:01XYZ...",
  "inputs": {
    "data": "...",
    "format": "json"
  }
}
```

## Rate Limits

- **Free tier**: 100 requests/hour
- **Pro tier**: 1,000 requests/hour
- **Enterprise**: Custom limits

## SDKs

Official SDKs available for:
- Python: `pip install promptowl`
- Node.js: `npm install @promptowl/sdk`
- Go: `go get github.com/promptowl/go-sdk`

## Webhook Integration

Subscribe to events:

```json
{
  "url": "https://your-app.com/webhooks/promptowl",
  "events": [
    "conversation.completed",
    "artifact.created",
    "workflow.failed"
  ]
}
```

## Support

- Documentation: https://docs.promptowl.ai
- Discord: https://discord.gg/promptowl
- Email: api-support@promptowl.ai

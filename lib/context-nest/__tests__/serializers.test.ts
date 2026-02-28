/**
 * Context Nest Serializers Tests @unit
 */

import {
  serializeDocument,
  deserializeDocument,
  documentToMarkdown,
  parseMarkdown,
  serializeStewards,
  deserializeStewards,
  generateIndex,
  titleToFilename,
  extractMetadata,
} from "../serializers";
import type { ContextDocument, ContextSteward } from "../types";

describe("Context Nest Serializers @unit", () => {
  describe("titleToFilename", () => {
    it("converts title to kebab-case filename", () => {
      expect(titleToFilename("API Design Guidelines")).toBe("api-design-guidelines");
      expect(titleToFilename("Hello World!")).toBe("hello-world");
      expect(titleToFilename("Test  Multiple   Spaces")).toBe("test-multiple-spaces");
    });
  });

  describe("extractMetadata", () => {
    it("extracts wiki links from markdown", () => {
      const body = "See [[API Design]] for details. Also check [[Other Page|the other page]].";
      const result = extractMetadata(body);

      expect(result.wikiLinks).toHaveLength(2);
      expect(result.wikiLinks[0].targetTitle).toBe("API Design");
      expect(result.wikiLinks[1].targetTitle).toBe("Other Page");
      expect(result.wikiLinks[1].displayText).toBe("the other page");
    });

    it("extracts tags from markdown", () => {
      const body = "This covers #api and #security topics. Also #best-practices.";
      const result = extractMetadata(body);

      expect(result.tags).toContain("api");
      expect(result.tags).toContain("security");
      expect(result.tags).toContain("best-practices");
    });

    it("extracts mentions from markdown", () => {
      const body = "Assigned to @john.doe for review. CC @team:engineering here.";
      const result = extractMetadata(body);

      expect(result.mentions).toHaveLength(2);
      expect(result.mentions[0]).toEqual({ type: "user", name: "john.doe" });
      expect(result.mentions[1]).toEqual({ type: "team", name: "engineering" });
    });

    it("extracts tasks from markdown", () => {
      const body = `
- [ ] Incomplete task
- [x] Completed task
- [ ] Task for @john.doe
      `;
      const result = extractMetadata(body);

      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].completed).toBe(false);
      expect(result.tasks[1].completed).toBe(true);
      expect(result.tasks[2].assigneeName).toBe("john.doe");
    });
  });

  describe("parseMarkdown / documentToMarkdown", () => {
    it("round-trips a document with frontmatter", () => {
      const markdown = `---
title: Test Document
tags:
  - api
  - test
status: draft
version: 1
---

# Test Document

This is the body content.

See [[Other Page]] for more.
`;

      const parsed = parseMarkdown(markdown);

      expect(parsed.frontmatter.title).toBe("Test Document");
      expect(parsed.frontmatter.tags).toEqual(["api", "test"]);
      expect(parsed.frontmatter.status).toBe("draft");
      expect(parsed.body).toContain("# Test Document");
      expect(parsed.body).toContain("[[Other Page]]");
    });

    it("handles document without frontmatter", () => {
      const markdown = "# Just Content\n\nNo frontmatter here.";
      const parsed = parseMarkdown(markdown);

      expect(parsed.frontmatter.title).toBe("Untitled");
      expect(parsed.body).toBe(markdown);
    });
  });

  describe("serializeDocument / deserializeDocument", () => {
    const mockDocument: ContextDocument = {
      id: "doc_123",
      title: "API Design Guidelines",
      content: "# API Design\n\nGuidelines here.\n\n#api #guidelines",
      dataRoomId: "dr_456",
      folderId: "folder_789",
      ownerId: "user_abc",
      tags: ["api", "guidelines"],
      wikiLinks: [],
      mentions: [],
      tasks: [],
      backlinks: [],
      version: 2,
      versions: [],
      lifecycleStatus: "approved",
      approvedVersion: 1,
      approvedAt: new Date("2024-01-20"),
      approvedBy: "user_xyz",
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-20"),
    };

    const userEmails: Record<string, string> = {
      user_abc: "author@example.com",
      user_xyz: "approver@example.com",
    };

    it("serializes a document to spec format", () => {
      const serialized = serializeDocument(mockDocument, userEmails, "engineering");

      expect(serialized.frontmatter.id).toBe("doc_123");
      expect(serialized.frontmatter.title).toBe("API Design Guidelines");
      expect(serialized.frontmatter.tags).toEqual(["api", "guidelines"]);
      expect(serialized.frontmatter.status).toBe("approved");
      expect(serialized.frontmatter.author).toBe("author@example.com");
      expect(serialized.frontmatter.approved_by).toBe("approver@example.com");
      expect(serialized.filename).toBe("api-design-guidelines.md");
      expect(serialized.folderPath).toBe("engineering");
    });

    it("deserializes back to document format", () => {
      const serialized = serializeDocument(mockDocument, userEmails, "");
      const userIds: Record<string, string> = {
        "author@example.com": "user_abc",
        "approver@example.com": "user_xyz",
      };

      const deserialized = deserializeDocument(serialized, "dr_456", undefined, userIds);

      expect(deserialized.title).toBe("API Design Guidelines");
      expect(deserialized.tags).toContain("api");
      expect(deserialized.lifecycleStatus).toBe("approved");
    });
  });

  describe("generateIndex", () => {
    it("generates INDEX.md content", () => {
      const documents = [
        {
          title: "API Guidelines",
          status: "approved" as const,
          tags: ["api"],
          updatedAt: new Date("2024-01-20"),
        },
        {
          title: "Security Policy",
          status: "draft" as const,
          tags: ["security"],
          updatedAt: new Date("2024-01-18"),
        },
      ];

      const subfolders = [
        { name: "Decisions", path: "engineering/decisions", description: "ADRs" },
      ];

      const index = generateIndex("Engineering", "Technical docs", documents, subfolders);

      expect(index).toContain("# Engineering");
      expect(index).toContain("Technical docs");
      expect(index).toContain("[[API Guidelines]]");
      expect(index).toContain("[[Security Policy]]");
      expect(index).toContain("approved");
      expect(index).toContain("draft");
      expect(index).toContain("[[engineering/decisions/INDEX|Decisions]]");
      expect(index).toContain("Total documents: 2");
      expect(index).toContain("Approved: 1");
    });
  });

  describe("serializeStewards / deserializeStewards", () => {
    const mockStewards: ContextSteward[] = [
      {
        id: "steward_1",
        dataRoomId: "dr_123",
        scope: "dataRoom",
        stewardUserId: "user_admin",
        canApprove: true,
        canReject: true,
        canDelegate: true,
        assignedBy: "user_admin",
        assignedAt: new Date(),
        isActive: true,
      },
      {
        id: "steward_2",
        dataRoomId: "dr_123",
        scope: "tag",
        tagName: "security",
        stewardUserId: "user_security",
        canApprove: true,
        canReject: true,
        canDelegate: false,
        assignedBy: "user_admin",
        assignedAt: new Date(),
        isActive: true,
      },
    ];

    const userEmails: Record<string, string> = {
      user_admin: "admin@example.com",
      user_security: "security@example.com",
    };

    it("serializes stewards to YAML config format", () => {
      const config = serializeStewards(mockStewards, userEmails, {});

      expect(config.version).toBe(1);
      expect(config.data_room).toHaveLength(1);
      expect(config.data_room![0].email).toBe("admin@example.com");
      expect(config.data_room![0].can_delegate).toBe(true);
      expect(config.tags?.security).toHaveLength(1);
      expect(config.tags?.security[0].email).toBe("security@example.com");
    });

    it("deserializes YAML config back to steward objects", () => {
      const config = serializeStewards(mockStewards, userEmails, {});
      const userIds: Record<string, string> = {
        "admin@example.com": "user_admin",
        "security@example.com": "user_security",
      };

      const deserialized = deserializeStewards(config, "dr_123", userIds, {}, {});

      expect(deserialized).toHaveLength(2);
      const dataRoomSteward = deserialized.find((s) => s.scope === "dataRoom");
      expect(dataRoomSteward?.canDelegate).toBe(true);
      const tagSteward = deserialized.find((s) => s.scope === "tag");
      expect(tagSteward?.tagName).toBe("security");
    });
  });
});

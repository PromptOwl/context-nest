#!/usr/bin/env node
/**
 * ContextNest MCP Server v0.3.0
 *
 * Modes:
 *   local — reads/writes vault files directly (filesystem)
 *   api   — talks to a ContextNest API endpoint (HTTP)
 *
 * Tools (read):
 *   context_init     — Load CONTEXT.md (vault instructions)
 *   context_overview  — Full vault map
 *   context_search    — Full-text keyword search
 *   context_query     — Selector queries (#tag, type:X, [[Title]])
 *   context_get       — Get a node by title or ID
 *   context_list      — Browse with filters
 *   context_resolve   — Full resolution with token budget
 *
 * Tools (write, when permissions allow):
 *   context_create    — Create a new node
 *   context_update    — Update/append to existing node
 *
 * Config (env vars):
 *   CONTEXT_MODE       — "local" or "api" (default: local)
 *   CONTEXT_VAULT_PATH — Path to vault directory (local mode)
 *   CONTEXT_API_URL    — API base URL (api mode, e.g. http://localhost:3001)
 *   CONTEXT_PERMISSIONS — "read-write" or "read-only" (default: read-write)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readdir, readFile, writeFile, stat, mkdir } from "fs/promises";
import { join, extname, basename } from "path";
import { randomUUID } from "crypto";
import matter from "gray-matter";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ContextNode {
  id: string;
  title: string;
  type: string;
  owners: string[];
  scope?: string;
  tags?: string[];
  permissions?: { read?: string[]; write?: string[]; export?: string[] };
  content?: string;
  created_at?: string;
  updated_at?: string;
}

interface VaultOverview {
  total: number;
  types: Record<string, number>;
  tags: Record<string, number>;
  nodes: { title: string; type: string; tags?: string[]; snippet: string }[];
}

// ─── Backend Interface ──────────────────────────────────────────────────────

interface Backend {
  init(): Promise<void>;
  getContextMd(): Promise<string | null>;
  listNodes(): Promise<ContextNode[]>;
  getByTitle(title: string): Promise<ContextNode | null>;
  getById(id: string): Promise<ContextNode | null>;
  queryBySelector(query: string): Promise<ContextNode[]>;
  listFiltered(opts: { type?: string; tag?: string; limit?: number }): Promise<ContextNode[]>;
  search(query: string): Promise<ContextNode[]>;
  overview(): Promise<VaultOverview>;
  createNode(opts: { title: string; type: string; tags?: string[]; scope?: string; content: string }): Promise<ContextNode>;
  updateNode(title: string, opts: { content?: string; appendContent?: string; tags?: string[]; scope?: string }): Promise<ContextNode | null>;
}

// ─── Local (Filesystem) Backend ─────────────────────────────────────────────

class LocalBackend implements Backend {
  private vaultPath: string;
  private nodesCache: ContextNode[] | null = null;
  private isStructured: boolean = false;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  async init(): Promise<void> {
    try {
      const nodesDir = join(this.vaultPath, "nodes");
      const stats = await stat(nodesDir);
      this.isStructured = stats.isDirectory();
    } catch {
      this.isStructured = false;
    }
  }

  private invalidateCache(): void {
    this.nodesCache = null;
  }

  async getContextMd(): Promise<string | null> {
    try {
      return await readFile(join(this.vaultPath, "CONTEXT.md"), "utf-8");
    } catch {
      return null;
    }
  }

  async listNodes(): Promise<ContextNode[]> {
    if (!this.nodesCache) {
      this.nodesCache = this.isStructured
        ? await this.loadStructuredVault()
        : await this.loadObsidianVault();
    }
    return this.nodesCache;
  }

  async getByTitle(title: string): Promise<ContextNode | null> {
    const nodes = await this.listNodes();
    return nodes.find(n => n.title.toLowerCase() === title.toLowerCase()) ?? null;
  }

  async getById(id: string): Promise<ContextNode | null> {
    const nodes = await this.listNodes();
    return nodes.find(n => n.id === id) ?? null;
  }

  async queryBySelector(query: string): Promise<ContextNode[]> {
    const nodes = await this.listNodes();
    return this.evaluateSelector(query, nodes);
  }

  async listFiltered(opts: { type?: string; tag?: string; limit?: number }): Promise<ContextNode[]> {
    let nodes = await this.listNodes();
    if (opts.type) nodes = nodes.filter(n => n.type === opts.type);
    if (opts.tag) {
      const tag = opts.tag.startsWith("#") ? opts.tag : `#${opts.tag}`;
      nodes = nodes.filter(n => n.tags?.includes(tag));
    }
    if (opts.limit) nodes = nodes.slice(0, opts.limit);
    return nodes;
  }

  async search(query: string): Promise<ContextNode[]> {
    const nodes = await this.listNodes();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return nodes.filter(n => {
      const haystack = [n.title, n.content || "", n.type, ...(n.tags || []), ...(n.owners || [])].join(" ").toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
  }

  async overview(): Promise<VaultOverview> {
    const nodes = await this.listNodes();
    const types: Record<string, number> = {};
    const tags: Record<string, number> = {};
    for (const n of nodes) {
      types[n.type] = (types[n.type] || 0) + 1;
      for (const t of n.tags || []) tags[t] = (tags[t] || 0) + 1;
    }
    return {
      total: nodes.length, types, tags,
      nodes: nodes.map(n => ({ title: n.title, type: n.type, tags: n.tags, snippet: (n.content || "").slice(0, 120).replace(/\n/g, " ") })),
    };
  }

  async createNode(opts: { title: string; type: string; tags?: string[]; scope?: string; content: string }): Promise<ContextNode> {
    const now = new Date().toISOString();
    const id = `ulid:${randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
    const slug = opts.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const tags = opts.tags?.map(t => t.startsWith("#") ? t : `#${t}`) || [];
    const fm: Record<string, any> = { id, title: opts.title, type: opts.type || "document", owners: ["*"], scope: opts.scope || "team", tags, created_at: now, updated_at: now };
    const fileContent = matter.stringify(opts.content, fm);
    if (this.isStructured) {
      await mkdir(join(this.vaultPath, "nodes"), { recursive: true });
      await writeFile(join(this.vaultPath, "nodes", `${slug}.md`), fileContent, "utf-8");
    } else {
      await writeFile(join(this.vaultPath, `${slug}.md`), fileContent, "utf-8");
    }
    this.invalidateCache();
    return { id, ...fm, content: opts.content } as ContextNode;
  }

  async updateNode(title: string, opts: { content?: string; appendContent?: string; tags?: string[]; scope?: string }): Promise<ContextNode | null> {
    const nodes = await this.listNodes();
    const node = nodes.find(n => n.title.toLowerCase() === title.toLowerCase());
    if (!node) return null;
    const now = new Date().toISOString();
    if (opts.content !== undefined) node.content = opts.content;
    if (opts.appendContent) node.content = (node.content || "") + "\n\n" + opts.appendContent;
    if (opts.tags) { const nt = opts.tags.map(t => t.startsWith("#") ? t : `#${t}`); node.tags = [...new Set([...(node.tags || []), ...nt])]; }
    if (opts.scope) node.scope = opts.scope;
    node.updated_at = now;
    const fm: Record<string, any> = { id: node.id, title: node.title, type: node.type, owners: node.owners, scope: node.scope, tags: node.tags, created_at: node.created_at, updated_at: now };
    if (node.permissions) fm.permissions = node.permissions;
    const fileContent = matter.stringify(node.content || "", fm);
    const slug = node.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (this.isStructured) {
      await writeFile(join(this.vaultPath, "nodes", `${slug}.md`), fileContent, "utf-8");
    } else {
      await writeFile(join(this.vaultPath, `${slug}.md`), fileContent, "utf-8");
    }
    this.invalidateCache();
    return node;
  }

  // ─── Selector Evaluation ───────────────────────────────────────────

  private evaluateSelector(query: string, allNodes: ContextNode[]): ContextNode[] {
    const orParts = query.split("|").map(s => s.trim());
    const unionResults = new Map<string, ContextNode>();
    for (const orPart of orParts) {
      const notParts = orPart.split("-").map(s => s.trim());
      const basePart = notParts[0];
      const excludeParts = notParts.slice(1);
      const andParts = basePart.split("+").map(s => s.trim());
      let result = allNodes;
      for (const part of andParts) result = this.matchPart(part, result);
      for (const excl of excludeParts) {
        const excluded = this.matchPart(excl, allNodes);
        const excludeIds = new Set(excluded.map(n => n.id));
        result = result.filter(n => !excludeIds.has(n.id));
      }
      for (const node of result) unionResults.set(node.id, node);
    }
    return Array.from(unionResults.values());
  }

  private matchPart(part: string, nodes: ContextNode[]): ContextNode[] {
    part = part.trim().replace(/^\(|\)$/g, "");
    if (part.startsWith("#")) return nodes.filter(n => n.tags?.includes(part));
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const title = part.slice(2, -2);
      return nodes.filter(n => n.title.toLowerCase() === title.toLowerCase());
    }
    if (part.includes(":")) {
      const [key, value] = part.split(":", 2);
      switch (key) {
        case "type": return nodes.filter(n => n.type === value);
        case "scope": return nodes.filter(n => n.scope === value);
        case "owner": return nodes.filter(n => n.owners.some(o => o.includes(value)));
      }
    }
    return nodes;
  }

  // ─── Vault Loading ─────────────────────────────────────────────────

  private async loadStructuredVault(): Promise<ContextNode[]> {
    const nodesDir = join(this.vaultPath, "nodes");
    const files = await readdir(nodesDir);
    const nodes: ContextNode[] = [];
    for (const file of files.filter(f => extname(f) === ".md")) {
      try {
        const raw = await readFile(join(nodesDir, file), "utf-8");
        const { data, content } = matter(raw);
        if (data.id && data.title && data.type && data.owners) {
          nodes.push({ id: data.id, title: data.title, type: data.type, owners: data.owners, scope: data.scope, tags: data.tags, permissions: data.permissions, content: content.trim(), created_at: data.created_at, updated_at: data.updated_at });
        }
      } catch { /* skip */ }
    }
    return nodes;
  }

  private async loadObsidianVault(): Promise<ContextNode[]> {
    const nodes: ContextNode[] = [];
    await this.scanDir(this.vaultPath, "", nodes);
    return nodes;
  }

  private async scanDir(dir: string, rel: string, nodes: ContextNode[]): Promise<void> {
    let entries: string[];
    try { entries = await readdir(dir); } catch { return; }
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const fullPath = join(dir, entry);
      const relPath = rel ? `${rel}/${entry}` : entry;
      let st; try { st = await stat(fullPath); } catch { continue; }
      if (st.isDirectory()) { await this.scanDir(fullPath, relPath, nodes); continue; }
      if (extname(entry) !== ".md") continue;
      try {
        const raw = await readFile(fullPath, "utf-8");
        const { data, content } = matter(raw);
        if (!content.trim() && !data.title) continue;
        const filename = basename(relPath, ".md");
        const contentTags = this.extractTags(content);
        const fmTags = Array.isArray(data.tags) ? data.tags.map((t: string) => (t.startsWith("#") ? t : `#${t}`)) : [];
        const allTags = [...new Set([...contentTags, ...fmTags])];
        nodes.push({ id: `path:${relPath.replace(/\.md$/, "").replace(/[/\\]/g, ".")}`, title: data.title || filename, type: data.type || "document", owners: data.owners || ["*"], scope: data.scope || "public", tags: allTags.length > 0 ? allTags : undefined, content: content.trim(), created_at: data.created || data.created_at, updated_at: data.updated || data.updated_at });
      } catch { /* skip */ }
    }
  }

  private extractTags(content: string): string[] {
    const tags = new Set<string>();
    const re = /(?:^|\s)#([a-zA-Z0-9_/-]+)/g;
    let m;
    while ((m = re.exec(content)) !== null) tags.add(`#${m[1]}`);
    return Array.from(tags);
  }
}

// ─── API Backend ────────────────────────────────────────────────────────────

class ApiBackend implements Backend {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
  }

  async init(): Promise<void> { /* no-op */ }

  private async fetchJson(path: string, opts?: RequestInit): Promise<any> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", ...opts?.headers },
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async getContextMd(): Promise<string | null> {
    const data = await this.fetchJson("/api/context-md");
    return data.content ?? null;
  }

  async listNodes(): Promise<ContextNode[]> {
    const data = await this.fetchJson("/api/nodes");
    return data.nodes || [];
  }

  async getByTitle(title: string): Promise<ContextNode | null> {
    try {
      const data = await this.fetchJson(`/api/nodes?title=${encodeURIComponent(title)}`);
      return data.node ?? null;
    } catch { return null; }
  }

  async getById(id: string): Promise<ContextNode | null> {
    // API doesn't have ID lookup yet, fall back to list scan
    const nodes = await this.listNodes();
    return nodes.find(n => n.id === id) ?? null;
  }

  async queryBySelector(query: string): Promise<ContextNode[]> {
    const data = await this.fetchJson("/api/query", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
    return data.nodes || [];
  }

  async listFiltered(opts: { type?: string; tag?: string; limit?: number }): Promise<ContextNode[]> {
    // Use list + client-side filtering (API doesn't have filter params yet)
    let nodes = await this.listNodes();
    if (opts.type) nodes = nodes.filter(n => n.type === opts.type);
    if (opts.tag) {
      const tag = opts.tag.startsWith("#") ? opts.tag : `#${opts.tag}`;
      nodes = nodes.filter(n => n.tags?.includes(tag));
    }
    if (opts.limit) nodes = nodes.slice(0, opts.limit);
    return nodes;
  }

  async search(query: string): Promise<ContextNode[]> {
    const data = await this.fetchJson(`/api/nodes?search=${encodeURIComponent(query)}`);
    return data.nodes || [];
  }

  async overview(): Promise<VaultOverview> {
    return this.fetchJson("/api/overview");
  }

  async createNode(opts: { title: string; type: string; tags?: string[]; scope?: string; content: string }): Promise<ContextNode> {
    const data = await this.fetchJson("/api/nodes", {
      method: "POST",
      body: JSON.stringify(opts),
    });
    return data.node;
  }

  async updateNode(title: string, opts: { content?: string; appendContent?: string; tags?: string[]; scope?: string }): Promise<ContextNode | null> {
    try {
      const data = await this.fetchJson("/api/nodes", {
        method: "PATCH",
        body: JSON.stringify({ title, ...opts, append: opts.appendContent }),
      });
      return data.node;
    } catch { return null; }
  }
}

// ─── Config ─────────────────────────────────────────────────────────────────

const MODE = (process.env.CONTEXT_MODE || "local").toLowerCase();
const VAULT_PATH = process.env.CONTEXT_VAULT_PATH;
const API_URL = process.env.CONTEXT_API_URL;
const PERMISSIONS = (process.env.CONTEXT_PERMISSIONS || "read-write").toLowerCase();
const canWrite = PERMISSIONS === "read-write";

if (MODE === "local" && !VAULT_PATH) {
  console.error("Error: CONTEXT_VAULT_PATH is required in local mode");
  process.exit(1);
}
if (MODE === "api" && !API_URL) {
  console.error("Error: CONTEXT_API_URL is required in api mode");
  process.exit(1);
}

const backend: Backend = MODE === "api"
  ? new ApiBackend(API_URL!)
  : new LocalBackend(VAULT_PATH!);

// ─── MCP Server ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "contextnest", version: "0.3.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const readTools = [
    {
      name: "context_init",
      description: "MANDATORY: You MUST call this tool FIRST at the very beginning of EVERY conversation, before responding to the user. It loads the vault's CONTEXT.md which contains your operating instructions, available knowledge, and behavioral guidelines — like a CLAUDE.md for the vault. Do NOT skip this step. If you haven't called context_init yet in this conversation, call it NOW before doing anything else.",
      inputSchema: { type: "object" as const, properties: {} },
    },
    {
      name: "context_overview",
      description: "Get a complete map of the vault: total node count, types, tags, and a title+snippet for every node. Call this AFTER context_init to understand what knowledge is available. When the user asks a question, check the overview to identify which nodes are relevant before answering.",
      inputSchema: { type: "object" as const, properties: {} },
    },
    {
      name: "context_search",
      description: "Full-text keyword search across all node content, titles, tags, and metadata. Use this when you need to find nodes related to a topic. ALWAYS search before answering questions — the vault likely has relevant context. Search broadly: if asked about 'onboarding', also search for related terms like 'first week', 'new employee', 'getting started'.",
      inputSchema: {
        type: "object" as const,
        properties: { query: { type: "string", description: "Search terms (e.g. 'onboarding first week')" } },
        required: ["query"],
      },
    },
    {
      name: "context_query",
      description: "Run a structured selector query against the vault. Supports: #tag, type:X, [[Title]], scope:X, owner:X. Combine with +AND, |OR, -NOT. Use this for precise filtering when you know the tags or types you want.",
      inputSchema: {
        type: "object" as const,
        properties: { query: { type: "string", description: "Selector query (e.g. '#onboarding + type:document')" } },
        required: ["query"],
      },
    },
    {
      name: "context_get",
      description: "Get the FULL content of a specific node by title or ID. After finding relevant nodes via search/query/overview, ALWAYS call context_get to read the full content before using it in your response. Snippets from overview/search are not enough — get the full text.",
      inputSchema: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Title of the node" },
          id: { type: "string", description: "ID of the node (alternative to title)" },
        },
      },
    },
    {
      name: "context_list",
      description: "Browse vault contents with optional type, tag, or limit filters. Useful for exploring what's in a specific category.",
      inputSchema: {
        type: "object" as const,
        properties: {
          type: { type: "string", description: "Filter by node type (e.g. 'document', 'snippet', 'policy')" },
          tag: { type: "string", description: "Filter by tag (e.g. '#engineering')" },
          limit: { type: "number", description: "Max nodes to return (default: 50)" },
        },
      },
    },
    {
      name: "context_resolve",
      description: "Full context resolution — run a selector and return complete node content, respecting a token budget. Use when you need multiple full nodes at once for a comprehensive answer.",
      inputSchema: {
        type: "object" as const,
        properties: {
          selector: { type: "string", description: "Selector query string" },
          max_tokens: { type: "number", description: "Approximate token budget (default: 8000)" },
        },
        required: ["selector"],
      },
    },
  ];

  const writeTools = [
    {
      name: "context_create",
      description: "Create a new knowledge node in the vault. You SHOULD proactively create nodes when: (1) the user shares new information, decisions, or insights worth retaining, (2) you synthesize useful knowledge during the conversation, (3) the user asks you to remember something, (4) you produce a summary, guide, or reference that has lasting value. Always include relevant tags and set scope appropriately. Use type 'snippet' for quick notes, 'document' for longer content.",
      inputSchema: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Descriptive title for the node" },
          content: { type: "string", description: "Markdown content body" },
          type: { type: "string", description: "Node type: document, snippet, glossary, persona, policy (default: document)" },
          tags: { type: "array", items: { type: "string" }, description: "Tags for categorization (e.g. ['#engineering', '#decisions'])" },
          scope: { type: "string", description: "Visibility: public, team, restricted (default: team)" },
        },
        required: ["title", "content"],
      },
    },
    {
      name: "context_update",
      description: "Update an existing node — append new information, replace content, add tags, or change scope. You SHOULD proactively update nodes when: (1) you discover new information related to an existing node, (2) the user corrects or refines existing knowledge, (3) context becomes outdated and needs refreshing. Prefer 'append' over 'content' to add to a node without losing existing information.",
      inputSchema: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Title of node to update (case-insensitive match)" },
          content: { type: "string", description: "New content (REPLACES existing entirely — use with care)" },
          append: { type: "string", description: "Content to APPEND to existing content (additive, safer)" },
          tags: { type: "array", items: { type: "string" }, description: "Additional tags to add" },
          scope: { type: "string", description: "New scope value" },
        },
        required: ["title"],
      },
    },
  ];

  return { tools: canWrite ? [...readTools, ...writeTools] : readTools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    await backend.init();

    switch (name) {
      case "context_init": {
        const contextMd = await backend.getContextMd();
        if (!contextMd) {
          return { content: [{ type: "text", text: `No CONTEXT.md found. Mode: ${MODE}. Use context_overview to see what's available.` }] };
        }
        return { content: [{ type: "text", text: `# Vault Instructions (CONTEXT.md)\n**Mode:** ${MODE} | **Permissions:** ${PERMISSIONS}\n\n${contextMd}` }] };
      }

      case "context_overview": {
        const overview = await backend.overview();
        const typeList = Object.entries(overview.types).sort((a, b) => b[1] - a[1]).map(([t, c]) => `  ${t}: ${c}`).join("\n");
        const tagList = Object.entries(overview.tags).sort((a, b) => b[1] - a[1]).map(([t, c]) => `  ${t}: ${c}`).join("\n");
        const nodeList = overview.nodes.map((n, i) => `${i + 1}. **${n.title}** [${n.type}] ${n.tags?.slice(0, 4).join(" ") || ""}\n   ${n.snippet}`).join("\n\n");
        return { content: [{ type: "text", text: `# Vault Overview\n**Mode:** ${MODE} | **Permissions:** ${PERMISSIONS}\n**Total nodes:** ${overview.total}\n\n## Types\n${typeList}\n\n## Tags\n${tagList}\n\n## All Nodes\n\n${nodeList}` }] };
      }

      case "context_search": {
        const { query } = args as any;
        const nodes = await backend.search(query);
        if (nodes.length === 0) return { content: [{ type: "text", text: `No nodes matched search: "${query}"` }] };
        const results = nodes.map((n, i) => `${i + 1}. **${n.title}** [${n.type}] ${n.tags?.join(" ") || ""}\n   ${(n.content || "").slice(0, 200).replace(/\n/g, " ")}`).join("\n\n");
        return { content: [{ type: "text", text: `Found ${nodes.length} node(s) matching "${query}":\n\n${results}` }] };
      }

      case "context_query": {
        const { query } = args as any;
        const nodes = await backend.queryBySelector(query);
        if (nodes.length === 0) return { content: [{ type: "text", text: `No nodes matched: ${query}` }] };
        const list = nodes.map((n, i) => `${i + 1}. **${n.title}** [${n.type}] ${n.tags?.join(" ") || ""}\n   Owners: ${n.owners.join(", ")} | Scope: ${n.scope || "—"}`).join("\n\n");
        return { content: [{ type: "text", text: `Found ${nodes.length} node(s) for \`${query}\`:\n\n${list}` }] };
      }

      case "context_get": {
        const { title, id } = args as any;
        const node = title ? await backend.getByTitle(title) : id ? await backend.getById(id) : null;
        if (!node) return { content: [{ type: "text", text: `Node not found: ${title || id}` }] };
        const meta = [`**Title:** ${node.title}`, `**Type:** ${node.type}`, `**Owners:** ${node.owners.join(", ")}`, node.tags ? `**Tags:** ${node.tags.join(" ")}` : null, node.scope ? `**Scope:** ${node.scope}` : null].filter(Boolean).join("\n");
        return { content: [{ type: "text", text: `${meta}\n\n---\n\n${node.content || "(no content)"}` }] };
      }

      case "context_list": {
        const { type, tag, limit } = args as any;
        const nodes = await backend.listFiltered({ type, tag, limit: limit || 50 });
        if (nodes.length === 0) return { content: [{ type: "text", text: "No nodes found with the given filters." }] };
        const list = nodes.map((n, i) => `${i + 1}. ${n.title} [${n.type}] ${n.tags?.slice(0, 5).join(" ") || ""}`).join("\n");
        const total = (await backend.listNodes()).length;
        return { content: [{ type: "text", text: `Vault: ${total} total nodes. Showing ${nodes.length}:\n\n${list}` }] };
      }

      case "context_resolve": {
        const { selector, max_tokens } = args as any;
        const nodes = await backend.queryBySelector(selector);
        if (nodes.length === 0) return { content: [{ type: "text", text: `No context matched: ${selector}` }] };
        let output = `# Context Resolution: \`${selector}\`\n\nResolved ${nodes.length} node(s).\n\n`;
        let approxTokens = 0;
        const budget = max_tokens || 8000;
        for (const node of nodes) {
          const section = `## ${node.title}\n**Type:** ${node.type} | **Tags:** ${node.tags?.join(" ") || "none"}\n\n${node.content || "(no content)"}\n\n---\n\n`;
          const sectionTokens = Math.ceil(section.length / 4);
          if (approxTokens + sectionTokens > budget) { output += `\n*(${nodes.length - nodes.indexOf(node)} more nodes truncated due to token budget)*\n`; break; }
          output += section;
          approxTokens += sectionTokens;
        }
        return { content: [{ type: "text", text: output }] };
      }

      case "context_create": {
        if (!canWrite) return { content: [{ type: "text", text: "Error: Write operations are disabled (permissions: read-only)" }], isError: true };
        const { title, content, type, tags, scope } = args as any;
        if (!title || !content) return { content: [{ type: "text", text: "Error: title and content are required" }], isError: true };
        const node = await backend.createNode({ title, type: type || "document", tags, scope, content });
        return { content: [{ type: "text", text: `Created node: **${node.title}** [${node.type}]\nID: ${node.id}\nTags: ${(node.tags || []).join(" ") || "none"}\nScope: ${node.scope}` }] };
      }

      case "context_update": {
        if (!canWrite) return { content: [{ type: "text", text: "Error: Write operations are disabled (permissions: read-only)" }], isError: true };
        const { title, content, append, tags, scope } = args as any;
        if (!title) return { content: [{ type: "text", text: "Error: title is required" }], isError: true };
        const node = await backend.updateNode(title, { content, appendContent: append, tags, scope });
        if (!node) return { content: [{ type: "text", text: `Node not found: "${title}"` }] };
        return { content: [{ type: "text", text: `Updated node: **${node.title}**\nTags: ${(node.tags || []).join(" ") || "none"}\nScope: ${node.scope}\nUpdated: ${node.updated_at}` }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`ContextNest MCP Server v0.3.0`);
  console.error(`Mode: ${MODE} | Permissions: ${PERMISSIONS}`);
  if (MODE === "local") console.error(`Vault: ${VAULT_PATH}`);
  if (MODE === "api") console.error(`API: ${API_URL}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

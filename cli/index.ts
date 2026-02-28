#!/usr/bin/env node
/**
 * ContextNest CLI
 * Query context vaults using the selector engine.
 *
 * Usage:
 *   npx tsx cli/index.ts "#onboarding" --vault ./engine/examples/vault
 *   npx tsx cli/index.ts "#onboarding" --vault /c/Users/misha/obsidianbrain
 *   npx tsx cli/index.ts "#guide + type:document - #deprecated" --vault ./engine/examples/vault
 *   npx tsx cli/index.ts "#runbook" --actor user:misha --vault ./engine/examples/vault
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, basename, resolve } from 'path';
import matter from 'gray-matter';

// Import engine types and classes directly
import { SelectorResolver } from '../engine/src/selector/resolver.js';
import { FileVaultProvider } from '../engine/src/storage/file-vault-provider.js';
import type { ContextNode, StorageProvider, NodeFilter, Principal, NodeType } from '../engine/src/types/index.js';
import { createActor } from '../engine/src/types/principal.js';

// ─── Obsidian Adapter ───────────────────────────────────────────────────────
// Reads plain markdown files (no ContextNode frontmatter required).
// Auto-generates IDs from file paths, infers type as 'document',
// extracts tags from content and YAML frontmatter.

class ObsidianVaultProvider implements StorageProvider {
  private vaultPath: string;
  private nodesCache: ContextNode[] | null = null;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  async listNodes(filter?: NodeFilter): Promise<ContextNode[]> {
    if (!this.nodesCache) {
      this.nodesCache = await this.scanVault();
    }
    return filter ? this.applyFilter(this.nodesCache, filter) : this.nodesCache;
  }

  async getNodeById(id: string): Promise<ContextNode | null> {
    const nodes = await this.listNodes();
    return nodes.find(n => n.id === id) ?? null;
  }

  async getNodeByTitle(title: string, owner?: string): Promise<ContextNode | null> {
    const nodes = await this.listNodes();
    return nodes.find(n => {
      const titleMatch = n.title.toLowerCase() === title.toLowerCase();
      if (!titleMatch) return false;
      if (owner) {
        return n.owners.some(o => o.includes(owner));
      }
      return true;
    }) ?? null;
  }

  async putNode(_node: ContextNode): Promise<void> {
    throw new Error('ObsidianVaultProvider is read-only');
  }

  async deleteNode(_id: string): Promise<void> {
    throw new Error('ObsidianVaultProvider is read-only');
  }

  private async scanVault(): Promise<ContextNode[]> {
    const nodes: ContextNode[] = [];
    await this.scanDirectory(this.vaultPath, '', nodes);
    return nodes;
  }

  private async scanDirectory(dir: string, relativePath: string, nodes: ContextNode[]): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      // Skip hidden dirs and common non-content dirs
      if (entry.startsWith('.') || entry === 'node_modules' || entry === '.obsidian') continue;

      const fullPath = join(dir, entry);
      const relPath = relativePath ? `${relativePath}/${entry}` : entry;

      let stats;
      try {
        stats = await stat(fullPath);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        await this.scanDirectory(fullPath, relPath, nodes);
      } else if (extname(entry) === '.md') {
        try {
          const node = await this.loadMarkdownFile(fullPath, relPath);
          if (node) nodes.push(node);
        } catch {
          // Skip files that can't be parsed
        }
      }
    }
  }

  private async loadMarkdownFile(filePath: string, relativePath: string): Promise<ContextNode | null> {
    const raw = await readFile(filePath, 'utf-8');
    const { data: frontmatter, content } = matter(raw);

    // Skip empty files
    if (!content.trim() && !frontmatter.title) return null;

    const filename = basename(relativePath, '.md');

    // Extract tags from content (#hashtags) and frontmatter
    const contentTags = this.extractHashtags(content);
    const fmTags: string[] = Array.isArray(frontmatter.tags)
      ? frontmatter.tags.map((t: string) => t.startsWith('#') ? t : `#${t}`)
      : [];
    const allTags = [...new Set([...contentTags, ...fmTags])];

    // Build the ContextNode
    const node: ContextNode = {
      id: `path:${relativePath.replace(/\.md$/, '').replace(/[/\\]/g, '.')}`,
      title: frontmatter.title || filename,
      type: (frontmatter.type as NodeType) || 'document',
      owners: frontmatter.owners || ['*' as Principal],
      scope: frontmatter.scope || 'public',
      tags: allTags.length > 0 ? allTags : undefined,
      content: content.trim(),
      created_at: frontmatter.created || frontmatter.created_at,
      updated_at: frontmatter.updated || frontmatter.updated_at,
    };

    if (frontmatter.permissions) {
      node.permissions = frontmatter.permissions;
    }

    return node;
  }

  private extractHashtags(content: string): string[] {
    // Match #tag patterns (not inside code blocks or links)
    const tagRegex = /(?:^|\s)#([a-zA-Z0-9_-]+)/g;
    const tags = new Set<string>();
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
      tags.add(`#${match[1]}`);
    }
    return Array.from(tags);
  }

  private applyFilter(nodes: ContextNode[], filter: NodeFilter): ContextNode[] {
    return nodes.filter(node => {
      if (filter.type && node.type !== filter.type) return false;
      if (filter.scope && node.scope !== filter.scope) return false;
      if (filter.tags) {
        if (!node.tags) return false;
        if (!filter.tags.every(t => node.tags!.includes(t))) return false;
      }
      if (filter.owners) {
        if (!filter.owners.some(o => node.owners.some(no => no.includes(o.split(':').pop()!)))) return false;
      }
      return true;
    });
  }
}

// ─── Vault Detection ────────────────────────────────────────────────────────
// Detect whether this is a structured ContextNest vault (has nodes/ dir)
// or a plain Obsidian vault (just markdown files).

async function detectVaultType(vaultPath: string): Promise<'contextnest' | 'obsidian'> {
  try {
    const nodesDir = join(vaultPath, 'nodes');
    const stats = await stat(nodesDir);
    if (stats.isDirectory()) return 'contextnest';
  } catch {
    // nodes/ doesn't exist
  }
  return 'obsidian';
}

function createProvider(vaultPath: string, type: 'contextnest' | 'obsidian'): StorageProvider {
  if (type === 'contextnest') {
    return new FileVaultProvider(vaultPath);
  }
  return new ObsidianVaultProvider(vaultPath);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(args: string[]): { query: string; vault: string; actor?: string; format: string } {
  let query = '';
  let vault = join(process.cwd(), 'engine', 'examples', 'vault');
  let actor: string | undefined;
  let format = 'markdown';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vault' && args[i + 1]) {
      vault = resolve(args[++i]);
    } else if (args[i] === '--actor' && args[i + 1]) {
      actor = args[++i];
    } else if (args[i] === '--format' && args[i + 1]) {
      format = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    } else if (!args[i].startsWith('--')) {
      query = args[i];
    }
  }

  return { query, vault, actor, format };
}

function printHelp(): void {
  console.log(`
ContextNest CLI — Query context vaults

Usage:
  npx tsx cli/index.ts <selector> [options]

Arguments:
  selector     Selector query (e.g. "#onboarding", "type:document", "[[Title]]")

Options:
  --vault <path>   Path to vault directory (default: ./engine/examples/vault)
  --actor <id>     Actor for permission filtering (e.g. user:misha, team:sre)
  --format <fmt>   Output format: markdown (default), json, titles
  --help, -h       Show this help

Examples:
  npx tsx cli/index.ts "#onboarding" --vault ./engine/examples/vault
  npx tsx cli/index.ts "#onboarding" --vault /c/Users/misha/obsidianbrain
  npx tsx cli/index.ts "#guide + type:document - #deprecated"
  npx tsx cli/index.ts "#runbook" --actor user:misha
  npx tsx cli/index.ts "type:glossary" --format json
`);
}

function formatNodeMarkdown(node: ContextNode, index: number): string {
  const lines: string[] = [];
  lines.push(`## ${index + 1}. ${node.title}`);
  lines.push('');

  // Metadata line
  const meta: string[] = [];
  meta.push(`**Type:** ${node.type}`);
  if (node.scope) meta.push(`**Scope:** ${node.scope}`);
  if (node.owners.length > 0) meta.push(`**Owners:** ${node.owners.join(', ')}`);
  if (node.tags && node.tags.length > 0) meta.push(`**Tags:** ${node.tags.join(' ')}`);
  lines.push(meta.join(' | '));
  lines.push('');

  // Content snippet (first 300 chars)
  if (node.content) {
    const snippet = node.content.length > 300
      ? node.content.substring(0, 300) + '...'
      : node.content;
    lines.push(snippet);
  }

  lines.push('');
  lines.push('---');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { query, vault, actor, format } = parseArgs(args);

  if (!query) {
    console.error('Error: No selector query provided.\n');
    printHelp();
    process.exit(1);
  }

  // Detect vault type and create provider
  const vaultType = await detectVaultType(vault);
  const provider = createProvider(vault, vaultType);

  console.log(`\n📂 Vault: ${vault} (${vaultType})`);
  console.log(`🔍 Query: ${query}`);
  if (actor) console.log(`👤 Actor: ${actor}`);
  console.log('');

  // Create resolver and run query
  const resolver = new SelectorResolver(provider);

  try {
    let nodes: ContextNode[];

    if (actor) {
      const actorObj = createActor(actor);
      nodes = await resolver.resolve(query, actorObj);
      console.log(`🔒 Filtered by actor: ${actor}`);
      console.log('');
    } else {
      nodes = await resolver.resolve(query);
    }

    if (nodes.length === 0) {
      console.log('No nodes matched the selector.');
      return;
    }

    console.log(`✅ Found ${nodes.length} node(s)\n`);

    // Output based on format
    switch (format) {
      case 'json':
        console.log(JSON.stringify(nodes.map(n => ({
          id: n.id,
          title: n.title,
          type: n.type,
          owners: n.owners,
          tags: n.tags,
          scope: n.scope,
          content_length: n.content?.length || 0,
        })), null, 2));
        break;

      case 'titles':
        nodes.forEach((n, i) => {
          const tags = n.tags?.join(' ') || '';
          console.log(`  ${i + 1}. ${n.title} [${n.type}] ${tags}`);
        });
        break;

      case 'markdown':
      default:
        nodes.forEach((n, i) => console.log(formatNodeMarkdown(n, i)));
        break;
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();

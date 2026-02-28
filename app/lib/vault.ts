/**
 * Vault access layer for the Next.js app.
 * Reads context nodes from the file system using the same logic as the MCP server.
 */

import { readdir, readFile, writeFile, stat, mkdir } from 'fs/promises';
import { join, extname, basename } from 'path';
import { randomUUID } from 'crypto';
import matter from 'gray-matter';

export interface ContextNode {
  id: string;
  title: string;
  type: string;
  owners: string[];
  scope?: string;
  tags?: string[];
  content?: string;
  created_at?: string;
  updated_at?: string;
}

const VAULT_PATH = process.env.CONTEXT_VAULT_PATH || join(process.cwd(), '..', 'engine', 'examples', 'vault');

let isStructured: boolean | null = null;

async function checkStructured(): Promise<boolean> {
  if (isStructured !== null) return isStructured;
  try {
    const nodesDir = join(VAULT_PATH, 'nodes');
    const stats = await stat(nodesDir);
    isStructured = stats.isDirectory();
  } catch {
    isStructured = false;
  }
  return isStructured;
}

function extractTags(content: string): string[] {
  const tags = new Set<string>();
  const re = /(?:^|\s)#([a-zA-Z0-9_/-]+)/g;
  let m;
  while ((m = re.exec(content)) !== null) tags.add(`#${m[1]}`);
  return Array.from(tags);
}

async function loadStructuredVault(): Promise<ContextNode[]> {
  const nodesDir = join(VAULT_PATH, 'nodes');
  const files = await readdir(nodesDir);
  const mdFiles = files.filter(f => extname(f) === '.md');

  const nodes: ContextNode[] = [];
  for (const file of mdFiles) {
    try {
      const raw = await readFile(join(nodesDir, file), 'utf-8');
      const { data, content } = matter(raw);
      if (data.id && data.title && data.type && data.owners) {
        nodes.push({
          id: data.id,
          title: data.title,
          type: data.type,
          owners: data.owners,
          scope: data.scope,
          tags: data.tags,
          content: content.trim(),
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      }
    } catch { /* skip */ }
  }
  return nodes;
}

async function scanDir(dir: string, rel: string, nodes: ContextNode[]): Promise<void> {
  let entries: string[];
  try { entries = await readdir(dir); } catch { return; }

  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const fullPath = join(dir, entry);
    const relPath = rel ? `${rel}/${entry}` : entry;
    let st;
    try { st = await stat(fullPath); } catch { continue; }

    if (st.isDirectory()) {
      await scanDir(fullPath, relPath, nodes);
    } else if (extname(entry) === '.md') {
      try {
        const raw = await readFile(fullPath, 'utf-8');
        const { data, content } = matter(raw);
        if (!content.trim() && !data.title) continue;

        const filename = basename(relPath, '.md');
        const contentTags = extractTags(content);
        const fmTags = Array.isArray(data.tags)
          ? data.tags.map((t: string) => (t.startsWith('#') ? t : `#${t}`))
          : [];
        const allTags = [...new Set([...contentTags, ...fmTags])];

        nodes.push({
          id: `path:${relPath.replace(/\.md$/, '').replace(/[/\\]/g, '.')}`,
          title: data.title || filename,
          type: data.type || 'document',
          owners: data.owners || ['*'],
          scope: data.scope || 'public',
          tags: allTags.length > 0 ? allTags : undefined,
          content: content.trim(),
          created_at: data.created || data.created_at,
          updated_at: data.updated || data.updated_at,
        });
      } catch { /* skip */ }
    }
  }
}

async function loadObsidianVault(): Promise<ContextNode[]> {
  const nodes: ContextNode[] = [];
  await scanDir(VAULT_PATH, '', nodes);
  return nodes;
}

export async function getAllNodes(): Promise<ContextNode[]> {
  const structured = await checkStructured();
  return structured ? loadStructuredVault() : loadObsidianVault();
}

export async function getNodeByTitle(title: string): Promise<ContextNode | null> {
  const nodes = await getAllNodes();
  return nodes.find(n => n.title.toLowerCase() === title.toLowerCase() || encodeURIComponent(n.title) === title) ?? null;
}

export async function queryNodes(query: string): Promise<ContextNode[]> {
  const allNodes = await getAllNodes();
  // Simple selector: supports #tag, type:X, AND (+), OR (|), NOT (-)
  const orParts = query.split('|').map(s => s.trim());
  const unionResults = new Map<string, ContextNode>();

  for (const orPart of orParts) {
    const notParts = orPart.split('-').map(s => s.trim());
    const basePart = notParts[0];
    const excludeParts = notParts.slice(1);

    const andParts = basePart.split('+').map(s => s.trim());
    let result = allNodes;
    for (const part of andParts) {
      result = matchPart(part.trim(), result);
    }

    for (const excl of excludeParts) {
      const excluded = matchPart(excl.trim(), allNodes);
      const excludeIds = new Set(excluded.map(n => n.id));
      result = result.filter(n => !excludeIds.has(n.id));
    }

    for (const node of result) unionResults.set(node.id, node);
  }

  return Array.from(unionResults.values());
}

function matchPart(part: string, nodes: ContextNode[]): ContextNode[] {
  part = part.replace(/^\(|\)$/g, '');
  if (part.startsWith('#')) return nodes.filter(n => n.tags?.includes(part));
  if (part.startsWith('[[') && part.endsWith(']]')) {
    const title = part.slice(2, -2);
    return nodes.filter(n => n.title.toLowerCase() === title.toLowerCase());
  }
  if (part.includes(':')) {
    const [key, value] = part.split(':', 2);
    switch (key) {
      case 'type': return nodes.filter(n => n.type === value);
      case 'scope': return nodes.filter(n => n.scope === value);
      case 'owner': return nodes.filter(n => n.owners.some(o => o.includes(value)));
    }
  }
  return nodes;
}

export function getVaultPath(): string {
  return VAULT_PATH;
}

export async function getContextMd(): Promise<string | null> {
  try {
    return await readFile(join(VAULT_PATH, 'CONTEXT.md'), 'utf-8');
  } catch {
    return null;
  }
}

export async function searchNodes(query: string): Promise<ContextNode[]> {
  const nodes = await getAllNodes();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return nodes.filter(n => {
    const haystack = [n.title, n.content || '', n.type, ...(n.tags || []), ...(n.owners || [])].join(' ').toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}

export async function createNode(opts: { title: string; type?: string; tags?: string[]; scope?: string; content: string }): Promise<ContextNode> {
  const structured = await checkStructured();
  const now = new Date().toISOString();
  const id = `ulid:${randomUUID().replace(/-/g, '').slice(0, 24).toUpperCase()}`;
  const slug = opts.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tags = opts.tags?.map(t => t.startsWith('#') ? t : `#${t}`) || [];

  const frontmatter: Record<string, any> = {
    id, title: opts.title, type: opts.type || 'document', owners: ['*'],
    scope: opts.scope || 'team', tags, created_at: now, updated_at: now,
  };

  const fileContent = matter.stringify(opts.content, frontmatter);

  if (structured) {
    const nodesDir = join(VAULT_PATH, 'nodes');
    await mkdir(nodesDir, { recursive: true });
    await writeFile(join(nodesDir, `${slug}.md`), fileContent, 'utf-8');
  } else {
    await writeFile(join(VAULT_PATH, `${slug}.md`), fileContent, 'utf-8');
  }

  // Reset structured check cache so new nodes are picked up
  isStructured = null;

  return { id, title: opts.title, type: opts.type || 'document', owners: ['*'], scope: opts.scope || 'team', tags, content: opts.content, created_at: now, updated_at: now };
}

export async function updateNode(title: string, opts: { content?: string; append?: string; tags?: string[]; scope?: string }): Promise<ContextNode | null> {
  const nodes = await getAllNodes();
  const node = nodes.find(n => n.title.toLowerCase() === title.toLowerCase());
  if (!node) return null;

  const structured = await checkStructured();
  const now = new Date().toISOString();

  if (opts.content !== undefined) node.content = opts.content;
  if (opts.append) node.content = (node.content || '') + '\n\n' + opts.append;
  if (opts.tags) {
    const newTags = opts.tags.map(t => t.startsWith('#') ? t : `#${t}`);
    node.tags = [...new Set([...(node.tags || []), ...newTags])];
  }
  if (opts.scope) node.scope = opts.scope;
  node.updated_at = now;

  const frontmatter: Record<string, any> = {
    id: node.id, title: node.title, type: node.type, owners: node.owners,
    scope: node.scope, tags: node.tags, created_at: node.created_at, updated_at: now,
  };

  const fileContent = matter.stringify(node.content || '', frontmatter);
  const slug = node.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (structured) {
    await writeFile(join(VAULT_PATH, 'nodes', `${slug}.md`), fileContent, 'utf-8');
  } else {
    await writeFile(join(VAULT_PATH, `${slug}.md`), fileContent, 'utf-8');
  }

  isStructured = null;
  return node;
}

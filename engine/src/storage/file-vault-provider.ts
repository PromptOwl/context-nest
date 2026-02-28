/**
 * File Vault Storage Provider
 * Reads context nodes from file system (Markdown + YAML frontmatter)
 *
 * Spec: specs/05-data-structures.md
 * Tests: src/storage/file-vault-provider.test.ts
 *
 * Supports Obsidian-style vaults with:
 * - nodes/*.md - Context node files
 * - packs/*.yml - Pack definitions
 * - policies/*.yml - Policy definitions
 * - syntax.yml - Selector syntax configuration
 * - actors.yml - Principal definitions
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import matter from 'gray-matter';
import type { ContextNode, NodeFilter, StorageProvider } from '../types/index.js';

export class FileVaultProviderError extends Error {
  constructor(message: string, public path?: string) {
    super(message + (path ? ` at ${path}` : ''));
    this.name = 'FileVaultProviderError';
  }
}

export class FileVaultProvider implements StorageProvider {
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  /**
   * List all nodes matching optional filter
   * Spec: specs/05-data-structures.md - Data Structure 1
   */
  async listNodes(filter?: NodeFilter): Promise<ContextNode[]> {
    try {
      const nodesDir = join(this.vaultPath, 'nodes');
      const files = await readdir(nodesDir);

      // Filter for .md files
      const mdFiles = files.filter(f => extname(f) === '.md');

      // Load all nodes
      const nodes = await Promise.all(
        mdFiles.map(file => this.loadNodeFromFile(join(nodesDir, file)))
      );

      // Apply filter if provided
      return filter ? this.applyFilter(nodes, filter) : nodes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileVaultProviderError(
          'Nodes directory not found',
          join(this.vaultPath, 'nodes')
        );
      }
      throw error;
    }
  }

  /**
   * Get node by ID
   */
  async getNodeById(id: string): Promise<ContextNode | null> {
    const allNodes = await this.listNodes();
    return allNodes.find(node => node.id === id) || null;
  }

  /**
   * Get node by title (optionally scoped to owner)
   */
  async getNodeByTitle(title: string, owner?: string): Promise<ContextNode | null> {
    const allNodes = await this.listNodes();

    // If owner specified, filter by owner first
    const candidates = owner
      ? allNodes.filter(node => node.owners.includes(owner as any))
      : allNodes;

    // Find by title
    return candidates.find(node => node.title === title) || null;
  }

  /**
   * Store/update node
   * Throws if nodes directory is not writable
   */
  async putNode(node: ContextNode): Promise<void> {
    throw new FileVaultProviderError(
      'Write operations not yet implemented',
      this.vaultPath
    );
  }

  /**
   * Delete node
   * Throws if nodes directory is not writable
   */
  async deleteNode(id: string): Promise<void> {
    throw new FileVaultProviderError(
      'Delete operations not yet implemented',
      this.vaultPath
    );
  }

  /**
   * Load a context node from a markdown file
   */
  private async loadNodeFromFile(filePath: string): Promise<ContextNode> {
    try {
      const fileContent = await readFile(filePath, 'utf-8');

      // Parse frontmatter
      const { data, content } = matter(fileContent);

      // Construct node from frontmatter + content
      const node: ContextNode = {
        ...data,
        content: content.trim() || undefined,
      } as ContextNode;

      // Validate required fields
      if (!node.id) {
        throw new FileVaultProviderError(
          `Missing required field 'id' in frontmatter`,
          filePath
        );
      }
      if (!node.title) {
        throw new FileVaultProviderError(
          `Missing required field 'title' in frontmatter`,
          filePath
        );
      }
      if (!node.type) {
        throw new FileVaultProviderError(
          `Missing required field 'type' in frontmatter`,
          filePath
        );
      }
      if (!node.owners || !Array.isArray(node.owners) || node.owners.length === 0) {
        throw new FileVaultProviderError(
          `Missing or invalid 'owners' field in frontmatter`,
          filePath
        );
      }

      return node;
    } catch (error) {
      if (error instanceof FileVaultProviderError) {
        throw error;
      }
      throw new FileVaultProviderError(
        `Failed to load node: ${(error as Error).message}`,
        filePath
      );
    }
  }

  /**
   * Apply filter to nodes
   */
  private applyFilter(nodes: ContextNode[], filter: NodeFilter): ContextNode[] {
    return nodes.filter(node => {
      // Filter by type
      if (filter.type && node.type !== filter.type) {
        return false;
      }

      // Filter by scope
      if (filter.scope && node.scope !== filter.scope) {
        return false;
      }

      // Filter by tags (node must have ALL specified tags)
      if (filter.tags && filter.tags.length > 0) {
        if (!node.tags || !filter.tags.every(tag => node.tags!.includes(tag))) {
          return false;
        }
      }

      // Filter by owner (node must have at least one matching owner)
      if (filter.owners && filter.owners.length > 0) {
        if (!node.owners || !filter.owners.some(owner => node.owners.includes(owner))) {
          return false;
        }
      }

      // Filter by date range (created_at)
      if (filter.before && node.created_at) {
        const nodeDate = new Date(node.created_at);
        if (nodeDate > filter.before) {
          return false;
        }
      }

      if (filter.after && node.created_at) {
        const nodeDate = new Date(node.created_at);
        if (nodeDate < filter.after) {
          return false;
        }
      }

      return true;
    });
  }
}

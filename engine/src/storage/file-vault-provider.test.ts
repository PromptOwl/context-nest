/**
 * File Vault Provider Tests
 * Tests loading context nodes from filesystem
 *
 * Uses examples/vault/ for test data
 */

import { FileVaultProvider, FileVaultProviderError } from './file-vault-provider.js';
import type { ContextNode, NodeFilter } from '../types/index.js';
import { join } from 'path';

describe('FileVaultProvider - Basic Operations', () => {
  let provider: FileVaultProvider;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    provider = new FileVaultProvider(vaultPath);
  });

  it('should load all nodes from example vault', async () => {
    const nodes = await provider.listNodes();

    expect(nodes).toBeDefined();
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.length).toBe(10); // We have 10 example nodes
  });

  it('should load node with all required fields', async () => {
    const nodes = await provider.listNodes();
    const node = nodes[0];

    expect(node.id).toBeDefined();
    expect(node.title).toBeDefined();
    expect(node.type).toBeDefined();
    expect(node.owners).toBeDefined();
    expect(Array.isArray(node.owners)).toBe(true);
    expect(node.owners.length).toBeGreaterThan(0);
  });

  it('should load node content', async () => {
    const nodes = await provider.listNodes();

    // All example nodes should have content
    nodes.forEach(node => {
      expect(node.content).toBeDefined();
      expect(typeof node.content).toBe('string');
      expect(node.content!.length).toBeGreaterThan(0);
    });
  });

  it('should load specific nodes from example vault', async () => {
    const nodes = await provider.listNodes();
    const titles = nodes.map(n => n.title);

    expect(titles).toContain('SEV Management Runbook');
    expect(titles).toContain('Onboarding Overview');
    expect(titles).toContain('Brand Guidelines');
    expect(titles).toContain('Company Glossary');
  });
});

describe('FileVaultProvider - Get by ID', () => {
  let provider: FileVaultProvider;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    provider = new FileVaultProvider(vaultPath);
  });

  it('should get node by ID', async () => {
    // First get all nodes to find a valid ID
    const allNodes = await provider.listNodes();
    const firstNode = allNodes[0];

    // Now fetch by ID
    const node = await provider.getNodeById(firstNode.id);

    expect(node).not.toBeNull();
    expect(node!.id).toBe(firstNode.id);
    expect(node!.title).toBe(firstNode.title);
  });

  it('should return null for non-existent ID', async () => {
    const node = await provider.getNodeById('ulid:99999999999999999999999999');

    expect(node).toBeNull();
  });
});

describe('FileVaultProvider - Get by Title', () => {
  let provider: FileVaultProvider;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    provider = new FileVaultProvider(vaultPath);
  });

  it('should get node by title', async () => {
    const node = await provider.getNodeByTitle('Brand Guidelines');

    expect(node).not.toBeNull();
    expect(node!.title).toBe('Brand Guidelines');
    expect(node!.type).toBe('document');
  });

  it('should return null for non-existent title', async () => {
    const node = await provider.getNodeByTitle('Non-Existent Document');

    expect(node).toBeNull();
  });

  it('should get node by title with owner scope', async () => {
    // First find a node to test with
    const allNodes = await provider.listNodes();
    const testNode = allNodes[0];
    const owner = testNode.owners[0];

    // Get by title with owner
    const node = await provider.getNodeByTitle(testNode.title, owner);

    expect(node).not.toBeNull();
    expect(node!.title).toBe(testNode.title);
    expect(node!.owners).toContain(owner);
  });

  it('should return null when title exists but owner does not match', async () => {
    const node = await provider.getNodeByTitle('Brand Guidelines', 'team:nonexistent');

    expect(node).toBeNull();
  });
});

describe('FileVaultProvider - Filtering', () => {
  let provider: FileVaultProvider;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    provider = new FileVaultProvider(vaultPath);
  });

  it('should filter by type', async () => {
    const filter: NodeFilter = { type: 'document' };
    const nodes = await provider.listNodes(filter);

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      expect(node.type).toBe('document');
    });
  });

  it('should filter by scope', async () => {
    const filter: NodeFilter = { scope: 'team' };
    const nodes = await provider.listNodes(filter);

    nodes.forEach(node => {
      expect(node.scope).toBe('team');
    });
  });

  it('should filter by single tag', async () => {
    const filter: NodeFilter = { tags: ['#onboarding'] };
    const nodes = await provider.listNodes(filter);

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      expect(node.tags).toBeDefined();
      expect(node.tags).toContain('#onboarding');
    });
  });

  it('should filter by multiple tags (AND logic)', async () => {
    const filter: NodeFilter = { tags: ['#onboarding', '#public'] };
    const nodes = await provider.listNodes(filter);

    // Nodes must have ALL specified tags
    nodes.forEach(node => {
      expect(node.tags).toBeDefined();
      expect(node.tags).toContain('#onboarding');
      expect(node.tags).toContain('#public');
    });
  });

  it('should return empty array when no nodes match tag filter', async () => {
    const filter: NodeFilter = { tags: ['#nonexistent'] };
    const nodes = await provider.listNodes(filter);

    expect(nodes).toEqual([]);
  });

  it('should filter by owner', async () => {
    const filter: NodeFilter = { owners: ['team:sre'] };
    const nodes = await provider.listNodes(filter);

    nodes.forEach(node => {
      expect(node.owners).toBeDefined();
      expect(node.owners.some(o => o === 'team:sre')).toBe(true);
    });
  });

  it('should filter by multiple owners (OR logic)', async () => {
    const filter: NodeFilter = { owners: ['team:sre', 'team:marketing'] };
    const nodes = await provider.listNodes(filter);

    // Node must have at least ONE of the specified owners
    nodes.forEach(node => {
      expect(node.owners).toBeDefined();
      const hasOwner = node.owners.some(
        o => o === 'team:sre' || o === 'team:marketing'
      );
      expect(hasOwner).toBe(true);
    });
  });

  it('should combine multiple filters (AND logic)', async () => {
    const filter: NodeFilter = {
      type: 'document',
      tags: ['#onboarding'],
    };
    const nodes = await provider.listNodes(filter);

    nodes.forEach(node => {
      expect(node.type).toBe('document');
      expect(node.tags).toBeDefined();
      expect(node.tags).toContain('#onboarding');
    });
  });

  it('should filter by date range (before)', async () => {
    const filter: NodeFilter = {
      before: new Date('2025-12-31'),
    };
    const nodes = await provider.listNodes(filter);

    // All nodes with created_at should be before the date
    nodes.forEach(node => {
      if (node.created_at) {
        const nodeDate = new Date(node.created_at);
        const beforeDate = new Date('2025-12-31');
        expect(nodeDate.getTime()).toBeLessThanOrEqual(beforeDate.getTime());
      }
    });
  });

  it('should filter by date range (after)', async () => {
    const filter: NodeFilter = {
      after: new Date('2024-01-01'),
    };
    const nodes = await provider.listNodes(filter);

    // All nodes with created_at should be after the date
    nodes.forEach(node => {
      if (node.created_at) {
        const nodeDate = new Date(node.created_at);
        const afterDate = new Date('2024-01-01');
        expect(nodeDate.getTime()).toBeGreaterThanOrEqual(afterDate.getTime());
      }
    });
  });

  it('should filter by date range (between)', async () => {
    const filter: NodeFilter = {
      after: new Date('2024-01-01'),
      before: new Date('2025-12-31'),
    };
    const nodes = await provider.listNodes(filter);

    // All nodes with created_at should be in range
    nodes.forEach(node => {
      if (node.created_at) {
        const nodeDate = new Date(node.created_at);
        const afterDate = new Date('2024-01-01');
        const beforeDate = new Date('2025-12-31');
        expect(nodeDate.getTime()).toBeGreaterThanOrEqual(afterDate.getTime());
        expect(nodeDate.getTime()).toBeLessThanOrEqual(beforeDate.getTime());
      }
    });
  });
});

describe('FileVaultProvider - Error Handling', () => {
  it('should throw error for non-existent vault path', async () => {
    const provider = new FileVaultProvider('/nonexistent/path');

    await expect(provider.listNodes()).rejects.toThrow(FileVaultProviderError);
    await expect(provider.listNodes()).rejects.toThrow('Nodes directory not found');
  });

  it('should throw error on putNode (not yet implemented)', async () => {
    const vaultPath = join(process.cwd(), 'examples', 'vault');
    const provider = new FileVaultProvider(vaultPath);

    const node: ContextNode = {
      id: 'ulid:test',
      title: 'Test',
      type: 'document',
      owners: ['user:test'],
    };

    await expect(provider.putNode(node)).rejects.toThrow(FileVaultProviderError);
    await expect(provider.putNode(node)).rejects.toThrow('not yet implemented');
  });
});

describe('FileVaultProvider - Integration with Example Vault', () => {
  let provider: FileVaultProvider;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    provider = new FileVaultProvider(vaultPath);
  });

  // Test against actual example vault structure
  it('should load SEV Runbook with correct properties', async () => {
    const node = await provider.getNodeByTitle('SEV Management Runbook');

    expect(node).not.toBeNull();
    expect(node!.type).toBe('document');
    expect(node!.owners).toContain('team:sre');
    expect(node!.tags).toContain('#runbook');
    expect(node!.tags).toContain('#sev');
    expect(node!.content).toContain('SEV Management Runbook');
  });

  it('should load Onboarding Overview with correct properties', async () => {
    const node = await provider.getNodeByTitle('Onboarding Overview');

    expect(node).not.toBeNull();
    expect(node!.type).toBe('document');
    expect(node!.tags).toContain('#onboarding');
    expect(node!.tags).toContain('#public');
  });

  it('should load Brand Guidelines with correct properties', async () => {
    const node = await provider.getNodeByTitle('Brand Guidelines');

    expect(node).not.toBeNull();
    expect(node!.type).toBe('document');
    expect(node!.owners).toContain('team:marketing');
    expect(node!.tags).toContain('#brand');
    expect(node!.tags).toContain('#public');
  });

  it('should load Company Glossary with correct type', async () => {
    const node = await provider.getNodeByTitle('Company Glossary');

    expect(node).not.toBeNull();
    expect(node!.type).toBe('glossary');
    expect(node!.tags).toContain('#glossary');
  });

  // Verify filtering works with example data
  it('should find public onboarding documents', async () => {
    const nodes = await provider.listNodes({
      tags: ['#onboarding', '#public'],
    });

    expect(nodes.length).toBe(1);
    expect(nodes[0].title).toBe('Onboarding Overview');
  });

  it('should find all SRE team documents', async () => {
    const nodes = await provider.listNodes({
      owners: ['team:sre'],
    });

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      expect(node.owners).toContain('team:sre');
    });
  });

  it('should distinguish between document and glossary types', async () => {
    const documents = await provider.listNodes({ type: 'document' });
    const glossaries = await provider.listNodes({ type: 'glossary' });

    expect(documents.length).toBe(6);
    expect(glossaries.length).toBe(1);
  });
});

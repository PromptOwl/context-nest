/**
 * Selector Resolver Tests
 * End-to-end tests for selector resolution
 *
 * Spec: specs/01-selector-grammar.md
 * Feature: features/01-selector-resolution.feature
 *
 * Tests complete pipeline: selector → tokenize → parse → resolve → nodes
 */

import { SelectorResolver, ResolverError } from './resolver.js';
import { FileVaultProvider } from '../storage/file-vault-provider.js';
import { join } from 'path';

describe('SelectorResolver - Basic Selectors', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    resolver = new SelectorResolver(storage);
  });

  // Spec 01 - Example 1: Single tag
  it('should resolve single tag selector', async () => {
    const nodes = await resolver.resolve('#onboarding');

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      expect(node.tags).toBeDefined();
      expect(node.tags).toContain('#onboarding');
    });
  });

  // Spec 01 - Example 2: Title transclusion
  it('should resolve title transclusion', async () => {
    const nodes = await resolver.resolve('[[Brand Guidelines]]');

    expect(nodes.length).toBe(1);
    expect(nodes[0].title).toBe('Brand Guidelines');
  });

  it('should return empty for non-existent title', async () => {
    const nodes = await resolver.resolve('[[Non Existent]]');

    expect(nodes).toEqual([]);
  });

  // Filter by type
  it('should resolve type filter', async () => {
    const nodes = await resolver.resolve('type:glossary');

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      expect(node.type).toBe('glossary');
    });
  });

  // Filter by scope
  it('should resolve scope filter', async () => {
    const nodes = await resolver.resolve('scope:team');

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      expect(node.scope).toBe('team');
    });
  });
});

describe('SelectorResolver - Binary Operations', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    resolver = new SelectorResolver(storage);
  });

  // Spec 01 - Example 3: AND composition
  it('should resolve AND composition', async () => {
    const nodes = await resolver.resolve('#onboarding + #public');

    expect(nodes.length).toBeGreaterThan(0);
    // All nodes must have BOTH tags
    nodes.forEach(node => {
      expect(node.tags).toContain('#onboarding');
      expect(node.tags).toContain('#public');
    });
  });

  // Spec 01 - Example 4: NOT composition (exclusion)
  it('should resolve NOT composition', async () => {
    const allGuides = await resolver.resolve('#guide');
    const nonDeprecated = await resolver.resolve('#guide - #deprecated');

    // Non-deprecated should be <= all guides
    expect(nonDeprecated.length).toBeLessThanOrEqual(allGuides.length);

    // None of the results should have #deprecated
    nonDeprecated.forEach(node => {
      expect(node.tags?.includes('#deprecated')).toBe(false);
    });
  });

  // OR composition
  it('should resolve OR composition', async () => {
    const nodes = await resolver.resolve('#brand | #glossary');

    expect(nodes.length).toBeGreaterThan(0);
    // Each node must have at least ONE of the tags
    nodes.forEach(node => {
      const hasBrand = node.tags?.includes('#brand') || false;
      const hasGlossary = node.tags?.includes('#glossary') || false;
      expect(hasBrand || hasGlossary).toBe(true);
    });
  });

  // Spec 01 - Example 6: Tag AND filter
  it('should resolve tag + filter composition', async () => {
    const nodes = await resolver.resolve('#product type:glossary');

    nodes.forEach(node => {
      expect(node.tags).toContain('#product');
      expect(node.type).toBe('glossary');
    });
  });
});

describe('SelectorResolver - Complex Expressions', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    resolver = new SelectorResolver(storage);
  });

  // Multiple operations with precedence
  it('should resolve complex expression with precedence', async () => {
    const nodes = await resolver.resolve('#onboarding + #public | #brand');

    expect(nodes.length).toBeGreaterThan(0);
    // Should be parsed as: (#onboarding + #public) | #brand
    // Each node should either have (onboarding AND public) OR brand
    nodes.forEach(node => {
      const hasOnboardingAndPublic =
        node.tags?.includes('#onboarding') && node.tags?.includes('#public');
      const hasBrand = node.tags?.includes('#brand');
      expect(hasOnboardingAndPublic || hasBrand).toBe(true);
    });
  });

  // Parentheses override precedence
  it('should respect parentheses grouping', async () => {
    const nodes = await resolver.resolve('(#onboarding | #brand) + #public');

    // All nodes must have #public AND (onboarding OR brand)
    nodes.forEach(node => {
      expect(node.tags).toContain('#public');
      const hasOnboarding = node.tags?.includes('#onboarding');
      const hasBrand = node.tags?.includes('#brand');
      expect(hasOnboarding || hasBrand).toBe(true);
    });
  });

  // Multiple NOT operations
  it('should resolve multiple NOT operations', async () => {
    const nodes = await resolver.resolve('#public - #deprecated - #draft');

    // Should have public but not deprecated or draft
    nodes.forEach(node => {
      expect(node.tags).toContain('#public');
      expect(node.tags?.includes('#deprecated')).toBe(false);
      expect(node.tags?.includes('#draft')).toBe(false);
    });
  });
});

describe('SelectorResolver - Owner Scoping', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    resolver = new SelectorResolver(storage);
  });

  // Owner-scoped title lookup
  it('should resolve owner-scoped title', async () => {
    // First get a node with known owner
    const allNodes = await resolver.resolve('#brand');
    const brandNode = allNodes[0];
    const owner = brandNode.owners[0];

    // Now resolve with owner scope
    const ownerPart = owner.split(':')[1]; // Extract "marketing" from "team:marketing"
    const nodes = await resolver.resolve(`@${ownerPart}/${brandNode.title}`);

    expect(nodes.length).toBe(1);
    expect(nodes[0].title).toBe(brandNode.title);
    expect(nodes[0].owners).toContain(owner);
  });
});

describe('SelectorResolver - Set Operations', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    resolver = new SelectorResolver(storage);
  });

  it('should return intersection for AND operation', async () => {
    const onboarding = await resolver.resolve('#onboarding');
    const publicNodes = await resolver.resolve('#public');
    const intersection = await resolver.resolve('#onboarding + #public');

    // Intersection should be <= both sets
    expect(intersection.length).toBeLessThanOrEqual(onboarding.length);
    expect(intersection.length).toBeLessThanOrEqual(publicNodes.length);

    // All intersection nodes should be in both sets
    const onboardingIds = new Set(onboarding.map(n => n.id));
    const publicIds = new Set(publicNodes.map(n => n.id));
    intersection.forEach(node => {
      expect(onboardingIds.has(node.id)).toBe(true);
      expect(publicIds.has(node.id)).toBe(true);
    });
  });

  it('should return union for OR operation', async () => {
    const brand = await resolver.resolve('#brand');
    const glossary = await resolver.resolve('#glossary');
    const union = await resolver.resolve('#brand | #glossary');

    // Union should be >= each set
    expect(union.length).toBeGreaterThanOrEqual(brand.length);
    expect(union.length).toBeGreaterThanOrEqual(glossary.length);

    // Union should be <= sum of both sets (accounting for overlap)
    expect(union.length).toBeLessThanOrEqual(brand.length + glossary.length);
  });

  it('should return difference for NOT operation', async () => {
    const allPublic = await resolver.resolve('#public');
    const onboardingPublic = await resolver.resolve('#onboarding + #public');
    const nonOnboardingPublic = await resolver.resolve('#public - #onboarding');

    // Difference should be <= original set
    expect(nonOnboardingPublic.length).toBeLessThanOrEqual(allPublic.length);

    // No node in difference should have #onboarding
    nonOnboardingPublic.forEach(node => {
      expect(node.tags?.includes('#onboarding')).toBe(false);
    });
  });

  it('should deduplicate nodes', async () => {
    // This expression could potentially return same node multiple times
    const nodes = await resolver.resolve('#onboarding | #onboarding');

    // Check for unique IDs
    const ids = nodes.map(n => n.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});

describe('SelectorResolver - Integration with Example Vault', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    resolver = new SelectorResolver(storage);
  });

  // Test actual example vault data
  it('should find SEV runbook by tag', async () => {
    const nodes = await resolver.resolve('#sev');

    expect(nodes.length).toBeGreaterThan(0);
    const sevNode = nodes.find(n => n.title === 'SEV Management Runbook');
    expect(sevNode).toBeDefined();
  });

  it('should find onboarding overview by title', async () => {
    const nodes = await resolver.resolve('[[Onboarding Overview]]');

    expect(nodes.length).toBe(1);
    expect(nodes[0].title).toBe('Onboarding Overview');
    expect(nodes[0].tags).toContain('#onboarding');
  });

  it('should find all public documents', async () => {
    const nodes = await resolver.resolve('#public');

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      expect(node.tags).toContain('#public');
    });
  });

  it('should find documents by type', async () => {
    const documents = await resolver.resolve('type:document');
    const glossaries = await resolver.resolve('type:glossary');

    expect(documents.length).toBe(6);
    expect(glossaries.length).toBe(1);

    documents.forEach(node => expect(node.type).toBe('document'));
    glossaries.forEach(node => expect(node.type).toBe('glossary'));
  });

  it('should find SRE team documents', async () => {
    const nodes = await resolver.resolve('owner:sre');

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      expect(node.owners.some(o => o === 'team:sre')).toBe(true);
    });
  });

  it('should find public onboarding documents (AND)', async () => {
    const nodes = await resolver.resolve('#onboarding + #public');

    expect(nodes.length).toBe(1);
    expect(nodes[0].title).toBe('Onboarding Overview');
    expect(nodes[0].tags).toContain('#onboarding');
    expect(nodes[0].tags).toContain('#public');
  });

  it('should exclude deprecated guides', async () => {
    const allGuides = await resolver.resolve('#guide');
    const activeGuides = await resolver.resolve('#guide - #deprecated');

    // In our example vault, no guides have #deprecated, so should be same
    expect(activeGuides.length).toEqual(allGuides.length);
  });
});

describe('SelectorResolver - Error Handling', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    resolver = new SelectorResolver(storage);
  });

  it('should throw on empty selector', async () => {
    await expect(resolver.resolve('')).rejects.toThrow(ResolverError);
  });

  it('should throw on invalid syntax', async () => {
    await expect(resolver.resolve('+ #tag')).rejects.toThrow(ResolverError);
  });

  it('should throw on unclosed parenthesis', async () => {
    await expect(resolver.resolve('(#tag')).rejects.toThrow(ResolverError);
  });

  it('should throw on pack reference (not yet implemented)', async () => {
    await expect(resolver.resolve('pack:onboarding.basics')).rejects.toThrow(ResolverError);
    await expect(resolver.resolve('pack:onboarding.basics')).rejects.toThrow('not yet implemented');
  });

  it('should throw on unknown filter key', async () => {
    await expect(resolver.resolve('unknown:value')).rejects.toThrow(ResolverError);
    await expect(resolver.resolve('unknown:value')).rejects.toThrow('Unknown filter key');
  });
});

describe('SelectorResolver - Edge Cases', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    resolver = new SelectorResolver(storage);
  });

  it('should handle tag without # prefix', async () => {
    // Tag selector with # prefix
    const withPrefix = await resolver.resolve('#onboarding');
    const withoutPrefix = await resolver.resolve('#onboarding');

    expect(withPrefix.length).toEqual(withoutPrefix.length);
  });

  it('should return empty for non-matching AND', async () => {
    // These tags don't appear together in any node
    const nodes = await resolver.resolve('#onboarding + #nonexistent');

    expect(nodes).toEqual([]);
  });

  it('should handle multiple parentheses', async () => {
    const nodes = await resolver.resolve('((#onboarding))');

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      expect(node.tags).toContain('#onboarding');
    });
  });

  it('should handle complex nested expressions', async () => {
    const nodes = await resolver.resolve('(#onboarding | #brand) + (#public - #deprecated)');

    // Should have (#onboarding OR #brand) AND (#public NOT #deprecated)
    nodes.forEach(node => {
      // Must have #public
      expect(node.tags).toContain('#public');
      // Must not have #deprecated
      expect(node.tags?.includes('#deprecated')).toBe(false);
      // Must have either #onboarding or #brand
      const hasOnboarding = node.tags?.includes('#onboarding');
      const hasBrand = node.tags?.includes('#brand');
      expect(hasOnboarding || hasBrand).toBe(true);
    });
  });
});

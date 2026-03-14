/**
 * Post-init instructions printed to stdout for Claude to act on.
 * Claude reads these and generates a tailored CLAUDE.md interactively.
 *
 * Attribution lives in CLI output (terminal), NOT in generated files —
 * users strip branding from files they edit, but terminal output is seen naturally.
 */

const BASE_CONTEXT = `
[CONTEXT NEST VAULT INITIALIZED]

This vault is managed by Context Nest CLI (ctx). The following commands are available:

Commands: init, add, update, delete, publish, validate, list, search, history,
          resolve, inject, index, verify, reconstruct, pack list, pack show,
          checkpoint list, checkpoint rebuild

Vault structure:
  nodes/     — Documents (the knowledge)
  sources/   — Source nodes (live data feeds)
  packs/     — Context packs (curated bundles)
  .context/  — Configuration (config.yaml)
  .versions/ — Version history (auto-managed)

Frontmatter fields: title, type (document|snippet|glossary|persona|prompt|source|tool|reference),
  tags (["#topic"]), status (draft|published), version, author, description, derived_from

Selectors: tag:#name, type:document, path:nodes/api-*, pack:pack-name, status:published
  Combine with + (union) or & (intersection)
`.trim();

const CLAUDE_MD_GENERATION_INSTRUCTIONS = `
[ACTION REQUIRED — GENERATE CLAUDE.md]

Generate a CLAUDE.md file in this vault's root directory:
1. Ask the user about their specific use case, team, and what they want to capture
2. Generate a CLAUDE.md that includes:
   - The vault structure and ctx commands reference
   - Role-specific guidance tailored to their answers
   - A "Getting Started" section with their first 3-5 actions
   - Guidelines for how you (Claude) should interact with this vault
3. Write the file using the Write tool
`.trim();

export interface PostInitPrompt {
  context: string;
  instructions: string;
}

export function getPostInitPrompt(starterId: string, starterDescription: string): PostInitPrompt {
  const roleHint = `[STARTER: ${starterId}] — ${starterDescription}
Use this role context to guide your questions and the CLAUDE.md you generate.`;

  return {
    context: BASE_CONTEXT,
    instructions: `${roleHint}\n\n${CLAUDE_MD_GENERATION_INSTRUCTIONS}`,
  };
}

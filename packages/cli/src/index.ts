/**
 * contextnest-cli — Command-line tool for Context Nest vault operations.
 */

import fs from "node:fs";
import pathMod from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import {
  NestStorage,
  validateDocument,
  parseSelector,
  evaluate,
  Resolver,
  PackLoader,
  VersionManager,
  CheckpointManager,
  ContextInjector,
  publishDocument,
  generateContextYaml,
  generateIndexMd,
  verifyDocumentChain,
  verifyCheckpointChain,
  topologicalSortSources,
  detectCycles,
  serializeDocument,
  parseUri,
} from "@promptowl/contextnest-engine";
import type { ContextNode, Frontmatter, LayoutMode } from "@promptowl/contextnest-engine";

const program = new Command();

program
  .name("ctx")
  .description("Context Nest CLI — manage structured, versioned context vaults")
  .version("0.1.0");

// Helper: resolve vault root
function getVaultRoot(): string {
  return process.env.CONTEXTNEST_VAULT_PATH || process.cwd();
}

function getStorage(): NestStorage {
  return new NestStorage(getVaultRoot());
}

async function regenerateIndex(storage: NestStorage): Promise<void> {
  const docs = await storage.discoverDocuments();
  const config = await storage.readConfig();
  const checkpointHistory = await storage.readCheckpointHistory();
  const latestCheckpoint = checkpointHistory?.checkpoints?.at(-1) ?? null;
  const published = docs.filter((d) => d.frontmatter.status === "published");

  const contextYaml = generateContextYaml(published, config, latestCheckpoint);
  await storage.writeContextYaml(contextYaml);

  const folders = new Map<string, ContextNode[]>();
  for (const doc of docs) {
    const parts = doc.id.split("/");
    const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder)!.push(doc);
  }

  for (const [folder, folderDocs] of folders) {
    if (folder === ".") continue;
    const title = folder.split("/").pop()!.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const indexMd = generateIndexMd(folder, title, folderDocs);
    await storage.writeIndexMd(folder, indexMd);
  }
}

// ─── ctx init ──────────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Initialize a new Context Nest vault")
  .option("-l, --layout <mode>", "Layout mode: structured or obsidian", "structured")
  .option("-n, --name <name>", "Vault name", "My Context Nest")
  .action(async (opts) => {
    const storage = getStorage();
    await storage.init(opts.name, opts.layout as LayoutMode);
    console.log(chalk.green(`Initialized ${opts.layout} vault: ${getVaultRoot()}`));
  });

// ─── ctx add ───────────────────────────────────────────────────────────────────

program
  .command("add <path>")
  .description("Create a new document with frontmatter template")
  .option("-t, --type <type>", "Node type", "document")
  .option("--title <title>", "Document title")
  .option("--tags <tags>", "Comma-separated tags")
  .option("--body <body>", "Markdown body content")
  .action(async (path, opts) => {
    const storage = getStorage();
    const id = path.replace(/\.md$/, "");
    const title = opts.title || id.split("/").pop()!.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

    const tagList = opts.tags
      ? opts.tags.split(",").map((t: string) => t.trim()).map((t: string) => (t.startsWith("#") ? t : `#${t}`))
      : undefined;
    const frontmatter: Frontmatter = {
      title,
      type: opts.type,
      status: "draft",
      version: 1,
      created_at: new Date().toISOString(),
      ...(tagList ? { tags: tagList } : {}),
    };

    const node: ContextNode = {
      id,
      filePath: "",
      frontmatter,
      body: opts.body ? `\n${opts.body}\n` : `\n# ${title}\n\n`,
      rawContent: "",
    };

    const content = serializeDocument(node);
    await storage.writeDocument(id, content);

    const result = await publishDocument(storage, id, {
      editedBy: "cli@contextnest.local",
      note: "Created via CLI",
    });

    await regenerateIndex(storage);

    console.log(chalk.green(`Created and published ${id}.md`));
    console.log(`  Version: ${result.node.frontmatter.version}`);
    console.log(`  Checkpoint: ${result.checkpointNumber}`);
  });

// ─── ctx validate ──────────────────────────────────────────────────────────────

program
  .command("validate [path]")
  .description("Validate documents against the Context Nest specification")
  .option("--json", "Output as JSON")
  .action(async (path, opts) => {
    const storage = getStorage();
    let docs: ContextNode[];

    if (path) {
      const id = path.replace(/\.md$/, "");
      docs = [await storage.readDocument(id)];
    } else {
      docs = await storage.discoverDocuments();
    }

    let hasErrors = false;
    const allErrors: Array<{ path: string; errors: any[] }> = [];

    for (const doc of docs) {
      const result = validateDocument(doc);
      if (!result.valid) {
        hasErrors = true;
        allErrors.push({ path: doc.id, errors: result.errors });
        if (!opts.json) {
          console.log(chalk.red(`✗ ${doc.id}`));
          for (const err of result.errors) {
            console.log(`  Rule ${err.rule}: ${err.message}${err.field ? ` (${err.field})` : ""}`);
          }
        }
      } else if (!opts.json) {
        console.log(chalk.green(`✓ ${doc.id}`));
      }
    }

    // Check for circular dependencies (rule 15)
    const sourceNodes = docs.filter((d) => d.frontmatter.type === "source");
    if (sourceNodes.length > 0) {
      const cycle = detectCycles(sourceNodes);
      if (cycle) {
        hasErrors = true;
        const err = { path: "sources", errors: [{ rule: 15, message: `Circular dependency: ${cycle.join(" → ")}` }] };
        allErrors.push(err);
        if (!opts.json) {
          console.log(chalk.red(`✗ Circular dependency detected: ${cycle.join(" → ")}`));
        }
      }
    }

    if (opts.json) {
      console.log(JSON.stringify({ valid: !hasErrors, errors: allErrors }, null, 2));
    } else {
      console.log(
        hasErrors
          ? chalk.red(`\nValidation failed with errors`)
          : chalk.green(`\nAll ${docs.length} documents valid`),
      );
    }

    if (hasErrors) process.exit(1);
  });

// ─── ctx resolve ───────────────────────────────────────────────────────────────

program
  .command("resolve <selector>")
  .description("Execute a selector query and list matching documents")
  .option("--json", "Output as JSON")
  .action(async (selector, opts) => {
    const storage = getStorage();
    const docs = await storage.discoverDocuments();
    const packs = await storage.readPacks();
    const resolver = new Resolver({ documents: docs });
    const packLoader = new PackLoader(packs);

    const ast = parseSelector(selector);
    const results = await evaluate(ast, {
      resolver,
      packLoader: (id) => packLoader.get(id),
    });

    if (opts.json) {
      console.log(
        JSON.stringify(
          results.map((d) => ({
            id: d.id,
            title: d.frontmatter.title,
            type: d.frontmatter.type || "document",
            status: d.frontmatter.status || "draft",
            tags: d.frontmatter.tags,
          })),
          null,
          2,
        ),
      );
    } else {
      if (results.length === 0) {
        console.log(chalk.yellow("No documents matched the selector."));
      } else {
        console.log(chalk.bold(`${results.length} document(s) matched:\n`));
        for (const doc of results) {
          const type = doc.frontmatter.type || "document";
          const status = doc.frontmatter.status || "draft";
          const statusColor = status === "published" ? chalk.green : chalk.yellow;
          console.log(`  ${chalk.cyan(doc.id)} [${type}] ${statusColor(status)}`);
          console.log(`    ${doc.frontmatter.title}`);
        }
      }
    }
  });

// ─── ctx publish ───────────────────────────────────────────────────────────────

program
  .command("publish <path>")
  .description("Publish a document (bump version, create checkpoint)")
  .option("-a, --author <email>", "Author email", "cli@contextnest.local")
  .option("-m, --message <note>", "Version note")
  .action(async (path, opts) => {
    const storage = getStorage();
    const id = path.replace(/\.md$/, "");

    const result = await publishDocument(storage, id, {
      editedBy: opts.author,
      note: opts.message,
    });

    await regenerateIndex(storage);

    console.log(chalk.green(`Published ${id}`));
    console.log(`  Version: ${result.node.frontmatter.version}`);
    console.log(`  Checkpoint: ${result.checkpointNumber}`);
    console.log(`  Chain hash: ${result.versionEntry.chain_hash}`);
  });

// ─── ctx history ───────────────────────────────────────────────────────────────

program
  .command("history <path>")
  .description("Show version history for a document")
  .option("--json", "Output as JSON")
  .action(async (path, opts) => {
    const storage = getStorage();
    const id = path.replace(/\.md$/, "");
    const vm = new VersionManager(storage);
    const history = await vm.getHistory(id);

    if (!history) {
      console.log(chalk.yellow(`No version history for ${id}`));
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(history, null, 2));
    } else {
      console.log(chalk.bold(`Version history for ${id}:\n`));
      for (const entry of history.versions) {
        const keyframe = entry.keyframe ? chalk.blue(" [keyframe]") : "";
        const published = entry.published_at ? chalk.green(" published") : chalk.yellow(" draft");
        console.log(`  v${entry.version}${keyframe}${published}`);
        console.log(`    By: ${entry.edited_by} at ${entry.edited_at}`);
        if (entry.note) console.log(`    Note: ${entry.note}`);
      }
    }
  });

// ─── ctx reconstruct ───────────────────────────────────────────────────────────

program
  .command("reconstruct <path> <version>")
  .description("Reconstruct a specific version of a document")
  .action(async (path, version) => {
    const storage = getStorage();
    const id = path.replace(/\.md$/, "");
    const vm = new VersionManager(storage);
    const content = await vm.reconstructVersion(id, parseInt(version, 10));
    console.log(content);
  });

// ─── ctx verify ────────────────────────────────────────────────────────────────

program
  .command("verify")
  .description("Verify integrity of all hash chains")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const storage = getStorage();
    const allHistories = await storage.findAllHistories();
    const checkpointHistory = await storage.readCheckpointHistory();

    let totalErrors = 0;
    const allReportErrors: any[] = [];

    // Verify each document chain
    for (const [docId, history] of allHistories) {
      const report = verifyDocumentChain(docId, history, (version) => {
        // Synchronous read — for CLI simplicity
        const docName = pathMod.basename(docId);
        const docDir = pathMod.dirname(docId);
        const keyframePath = pathMod.join(
          storage.root,
          docDir,
          ".versions",
          docName,
          `v${version}.md`,
        );
        try {
          return fs.readFileSync(keyframePath, "utf-8");
        } catch {
          return null;
        }
      });

      if (!report.valid) {
        totalErrors += report.errors.length;
        allReportErrors.push(...report.errors);
        if (!opts.json) {
          console.log(chalk.red(`✗ ${docId}: ${report.errors.length} error(s)`));
          for (const err of report.errors) {
            console.log(`  ${err.type} at version ${err.version}`);
          }
        }
      } else if (!opts.json) {
        console.log(chalk.green(`✓ ${docId}`));
      }
    }

    // Verify checkpoint chain
    if (checkpointHistory) {
      const report = verifyCheckpointChain(
        checkpointHistory.checkpoints,
        allHistories,
      );
      if (!report.valid) {
        totalErrors += report.errors.length;
        allReportErrors.push(...report.errors);
        if (!opts.json) {
          console.log(chalk.red(`✗ Checkpoint chain: ${report.errors.length} error(s)`));
          for (const err of report.errors) {
            console.log(`  ${err.type} at checkpoint ${err.checkpoint}`);
          }
        }
      } else if (!opts.json) {
        console.log(chalk.green(`✓ Checkpoint chain`));
      }
    }

    if (opts.json) {
      console.log(JSON.stringify({ valid: totalErrors === 0, errors: allReportErrors }, null, 2));
    } else {
      console.log(
        totalErrors === 0
          ? chalk.green("\nAll integrity checks passed")
          : chalk.red(`\n${totalErrors} integrity error(s) found`),
      );
    }

    if (totalErrors > 0) process.exit(1);
  });

// ─── ctx index ─────────────────────────────────────────────────────────────────

program
  .command("index")
  .description("Regenerate context.yaml and INDEX.md files")
  .action(async () => {
    const storage = getStorage();
    const docs = await storage.discoverDocuments();
    const config = await storage.readConfig();
    const checkpointHistory = await storage.readCheckpointHistory();
    const latestCheckpoint = checkpointHistory?.checkpoints?.at(-1) ?? null;
    const published = docs.filter((d) => d.frontmatter.status === "published");

    // Generate context.yaml
    const contextYaml = generateContextYaml(published, config, latestCheckpoint);
    await storage.writeContextYaml(contextYaml);
    console.log(chalk.green("Generated context.yaml"));

    // Generate INDEX.md for each folder
    const folders = new Map<string, ContextNode[]>();
    for (const doc of docs) {
      const parts = doc.id.split("/");
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder)!.push(doc);
    }

    for (const [folder, folderDocs] of folders) {
      if (folder === ".") continue;
      const title = folder.split("/").pop()!.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const indexMd = generateIndexMd(folder, title, folderDocs);
      await storage.writeIndexMd(folder, indexMd);
      console.log(chalk.green(`Generated ${folder}/INDEX.md`));
    }
  });

// ─── ctx inject ────────────────────────────────────────────────────────────────

program
  .command("inject <selector>")
  .description("Resolve and return context for injection into an AI agent")
  .option("--json", "Output as JSON")
  .action(async (selector, opts) => {
    const storage = getStorage();
    const docs = await storage.discoverDocuments();
    const packs = await storage.readPacks();
    const checkpointHistory = await storage.readCheckpointHistory();
    const currentCheckpoint = checkpointHistory?.checkpoints?.at(-1)?.checkpoint ?? 0;

    const resolver = new Resolver({ documents: docs });
    const packLoader = new PackLoader(packs);
    const injector = new ContextInjector({ resolver, packLoader, currentCheckpoint });

    const result = await injector.inject(selector);

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            documents: result.documents.map((d) => ({
              id: d.id,
              title: d.frontmatter.title,
              body: d.body,
            })),
            sourceNodes: result.sourceNodes.map((d) => ({
              id: d.id,
              title: d.frontmatter.title,
              source: d.frontmatter.source,
              body: d.body,
            })),
            traceCount: result.traces.length,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(chalk.bold("Documents:"));
      for (const doc of result.documents) {
        console.log(`  ${chalk.cyan(doc.id)}: ${doc.frontmatter.title}`);
      }
      if (result.sourceNodes.length > 0) {
        console.log(chalk.bold("\nSource Nodes (hydration order):"));
        for (const doc of result.sourceNodes) {
          console.log(`  ${chalk.magenta(doc.id)}: ${doc.frontmatter.title}`);
          console.log(`    Transport: ${doc.frontmatter.source?.transport}, Server: ${doc.frontmatter.source?.server || "n/a"}`);
        }
      }
      console.log(`\n${result.traces.length} trace entries recorded.`);
    }
  });

// ─── ctx list ─────────────────────────────────────────────────────────────────

program
  .command("list")
  .description("List all documents with optional filters")
  .option("-t, --type <type>", "Filter by node type")
  .option("-s, --status <status>", "Filter by status (draft/published)")
  .option("--tag <tag>", "Filter by tag")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const storage = getStorage();
    let docs = await storage.discoverDocuments();

    if (opts.type) docs = docs.filter((d) => (d.frontmatter.type || "document") === opts.type);
    if (opts.status) docs = docs.filter((d) => (d.frontmatter.status || "draft") === opts.status);
    if (opts.tag) {
      const normalizedTag = opts.tag.startsWith("#") ? opts.tag : `#${opts.tag}`;
      docs = docs.filter((d) => d.frontmatter.tags?.includes(normalizedTag));
    }

    if (opts.json) {
      console.log(
        JSON.stringify(
          docs.map((d) => ({
            id: d.id,
            title: d.frontmatter.title,
            type: d.frontmatter.type || "document",
            status: d.frontmatter.status || "draft",
            tags: d.frontmatter.tags,
          })),
          null,
          2,
        ),
      );
    } else {
      if (docs.length === 0) {
        console.log(chalk.yellow("No documents found."));
      } else {
        console.log(chalk.bold(`${docs.length} document(s):\n`));
        for (const doc of docs) {
          const type = doc.frontmatter.type || "document";
          const status = doc.frontmatter.status || "draft";
          const statusColor = status === "published" ? chalk.green : chalk.yellow;
          console.log(`  ${chalk.cyan(doc.id)} [${type}] ${statusColor(status)}`);
          console.log(`    ${doc.frontmatter.title}`);
        }
      }
    }
  });

// ─── ctx update ───────────────────────────────────────────────────────────────

program
  .command("update <path>")
  .description("Update a document's frontmatter and/or body, then auto-publish")
  .option("--title <title>", "New title")
  .option("--tags <tags>", "New tags (comma-separated, replaces existing)")
  .option("--body <body>", "New markdown body content")
  .action(async (path, opts) => {
    const storage = getStorage();
    const id = path.replace(/\.md$/, "");
    const doc = await storage.readDocument(id);

    if (opts.title !== undefined) doc.frontmatter.title = opts.title;
    if (opts.tags !== undefined) {
      doc.frontmatter.tags = opts.tags.split(",").map((t: string) => t.trim()).map((t: string) => (t.startsWith("#") ? t : `#${t}`));
    }
    doc.frontmatter.updated_at = new Date().toISOString();

    if (opts.body !== undefined) {
      doc.body = `\n${opts.body}\n`;
    }

    const validation = validateDocument(doc);
    if (!validation.valid) {
      console.log(chalk.red("Validation failed:"));
      for (const err of validation.errors) {
        console.log(`  Rule ${err.rule}: ${err.message}${err.field ? ` (${err.field})` : ""}`);
      }
      process.exit(1);
    }

    const content = serializeDocument(doc);
    await storage.writeDocument(id, content);

    const result = await publishDocument(storage, id, {
      editedBy: "cli@contextnest.local",
      note: "Updated via CLI",
    });

    await regenerateIndex(storage);

    console.log(chalk.green(`Updated and published ${id}`));
    console.log(`  Version: ${result.node.frontmatter.version}`);
    console.log(`  Checkpoint: ${result.checkpointNumber}`);
  });

// ─── ctx delete ───────────────────────────────────────────────────────────────

program
  .command("delete <path>")
  .description("Delete a document and its version history")
  .action(async (path) => {
    const storage = getStorage();
    const id = path.replace(/\.md$/, "");

    const doc = await storage.readDocument(id);
    await storage.deleteDocument(id);
    await regenerateIndex(storage);

    console.log(chalk.green(`Deleted ${id} (${doc.frontmatter.title})`));
  });

// ─── ctx search ───────────────────────────────────────────────────────────────

program
  .command("search <query>")
  .description("Full-text search across vault documents")
  .option("--json", "Output as JSON")
  .action(async (query, opts) => {
    const storage = getStorage();
    const docs = await storage.discoverDocuments();
    const resolver = new Resolver({ documents: docs });

    const uri = parseUri(`contextnest://search/${query.replace(/\s+/g, "+")}`);
    const results = await resolver.resolve(uri);

    if (opts.json) {
      console.log(
        JSON.stringify(
          results.map((d) => ({
            id: d.id,
            title: d.frontmatter.title,
            description: d.frontmatter.description,
            type: d.frontmatter.type || "document",
          })),
          null,
          2,
        ),
      );
    } else {
      if (results.length === 0) {
        console.log(chalk.yellow("No results found."));
      } else {
        console.log(chalk.bold(`${results.length} result(s):\n`));
        for (const doc of results) {
          console.log(`  ${chalk.cyan(doc.id)}: ${doc.frontmatter.title}`);
        }
      }
    }
  });

// ─── ctx pack ──────────────────────────────────────────────────────────────────

const packCmd = program.command("pack").description("Pack operations");

packCmd
  .command("list")
  .description("List all context packs")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const storage = getStorage();
    const packs = await storage.readPacks();

    if (opts.json) {
      console.log(JSON.stringify(packs, null, 2));
    } else {
      if (packs.length === 0) {
        console.log(chalk.yellow("No packs found."));
      } else {
        for (const pack of packs) {
          console.log(`  ${chalk.cyan(`pack:${pack.id}`)} — ${pack.label}`);
          if (pack.description) console.log(`    ${pack.description}`);
        }
      }
    }
  });

packCmd
  .command("show <id>")
  .description("Show pack details and resolved documents")
  .action(async (id) => {
    const storage = getStorage();
    const packs = await storage.readPacks();
    const packLoader = new PackLoader(packs);
    const pack = packLoader.get(id);

    if (!pack) {
      console.log(chalk.red(`Pack "${id}" not found`));
      process.exit(1);
    }

    console.log(chalk.bold(pack.label));
    if (pack.description) console.log(pack.description);
    if (pack.query) console.log(`\nQuery: ${chalk.cyan(pack.query)}`);
    if (pack.includes?.length) console.log(`Includes: ${pack.includes.join(", ")}`);
    if (pack.excludes?.length) console.log(`Excludes: ${pack.excludes.join(", ")}`);
    if (pack.agent_instructions) {
      console.log(chalk.bold("\nAgent Instructions:"));
      console.log(pack.agent_instructions);
    }
  });

// ─── ctx checkpoint ────────────────────────────────────────────────────────────

const cpCmd = program.command("checkpoint").description("Checkpoint operations");

cpCmd
  .command("list")
  .description("List all checkpoints")
  .option("--json", "Output as JSON")
  .option("-n, --limit <n>", "Number of recent checkpoints to show", "10")
  .action(async (opts) => {
    const storage = getStorage();
    const cm = new CheckpointManager(storage);
    const history = await cm.loadCheckpointHistory();

    if (!history || history.checkpoints.length === 0) {
      console.log(chalk.yellow("No checkpoints found."));
      return;
    }

    const limit = parseInt(opts.limit, 10);
    const checkpoints = history.checkpoints.slice(-limit);

    if (opts.json) {
      console.log(JSON.stringify(checkpoints, null, 2));
    } else {
      for (const cp of checkpoints) {
        console.log(`  Checkpoint ${chalk.bold(String(cp.checkpoint))} — ${cp.at}`);
        console.log(`    Triggered by: ${cp.triggered_by}`);
        console.log(`    Documents: ${Object.keys(cp.document_versions).length}`);
      }
    }
  });

cpCmd
  .command("rebuild")
  .description("Rebuild checkpoint history from per-document histories")
  .action(async () => {
    const storage = getStorage();
    const cm = new CheckpointManager(storage);
    const history = await cm.rebuildCheckpointHistory();
    console.log(chalk.green(`Rebuilt ${history.checkpoints.length} checkpoints`));
  });

// Parse and run
program.parse();

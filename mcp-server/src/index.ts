#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PROMPTOWL_API_URL = process.env.PROMPTOWL_API_URL || "https://app.promptowl.ai";
const PROMPTOWL_API_KEY = process.env.PROMPTOWL_API_KEY;

if (!PROMPTOWL_API_KEY) {
  console.error("Error: PROMPTOWL_API_KEY environment variable is required");
  console.error("Please set it in your MCP server configuration:");
  console.error('  "env": { "PROMPTOWL_API_KEY": "po_user_your_key_here" }');
  process.exit(1);
}

try {
  const url = new URL(PROMPTOWL_API_URL);
  if (!url.protocol.startsWith('http')) {
    throw new Error('Invalid protocol');
  }
} catch (error) {
  console.error(`Invalid PROMPTOWL_API_URL: ${PROMPTOWL_API_URL}`);
  process.exit(1);
}

const server = new Server(
  {
    name: "promptowl",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_agent",
        description: "Create a new PromptOwl agent with the specified configuration. The agent will be created in draft mode and can be tested/refined in PromptOwl before activation.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the agent (required)",
            },
            description: {
              type: "string",
              description: "Description of what the agent does",
            },
            instructions: {
              type: "string",
              description: "System instructions for the agent (required). These are the core prompts that define the agent's behavior.",
            },
            runMode: {
              type: "string",
              enum: ["default", "sequential", "supervisor"],
              description: "Execution mode: 'default' for single-step agents, 'sequential' for multi-step workflows, 'supervisor' for multi-agent coordination",
              default: "default",
            },
            variables: {
              type: "object",
              description: "Input variables the agent accepts, defined as key-value pairs where keys are variable names and values are default/empty strings. Example: {\"code\": \"\", \"requirements\": \"\"}",
              additionalProperties: { type: "string" },
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for categorization and discovery (e.g., ['security', 'code-review'])",
            },
            llmType: {
              type: "string",
              enum: ["claude", "openai", "gemini", "groq"],
              description: "LLM provider to use",
              default: "claude",
            },
            model: {
              type: "string",
              description: "Specific model to use (e.g., 'claude-sonnet-4-5', 'gpt-4')",
              default: "claude-sonnet-4-5",
            },
            temperature: {
              type: "number",
              description: "Temperature setting (0-2). Higher values make output more random.",
              default: 0.7,
              minimum: 0,
              maximum: 2,
            },
          },
          required: ["name", "instructions"],
        },
      },
      {
        name: "list_agents",
        description: "List all agents in your PromptOwl account with optional filtering by tags",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of agents to return",
              default: 50,
            },
            offset: {
              type: "number",
              description: "Number of agents to skip (for pagination)",
              default: 0,
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Filter by tags (returns agents matching any of the specified tags)",
            },
          },
        },
      },
      {
        name: "get_agent",
        description: "Get full details of a specific agent by ID, including all configuration and blocks",
        inputSchema: {
          type: "object",
          properties: {
            promptId: {
              type: "string",
              description: "The ID of the agent to retrieve",
            },
          },
          required: ["promptId"],
        },
      },
      {
        name: "export_agent_markdown",
        description: "Export an agent as Claude Code compatible markdown format",
        inputSchema: {
          type: "object",
          properties: {
            promptId: {
              type: "string",
              description: "The ID of the agent to export",
            },
          },
          required: ["promptId"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_agent": {
        const {
          name,
          description,
          instructions,
          runMode,
          variables,
          tags,
          llmType,
          model,
          temperature,
        } = args as any;

        const payload: any = {
          name,
          instructions,
        };

        if (description) payload.description = description;
        if (runMode) payload.runMode = runMode;
        if (variables) payload.variables = variables;
        if (tags) payload.tags = tags;
        if (llmType) payload.llmType = llmType;

        if (model || temperature !== undefined) {
          payload.llmSettings = {};
          if (model) payload.llmSettings.model = model;
          if (temperature !== undefined) payload.llmSettings.temperature = temperature;
        }

        const response = await fetch(`${PROMPTOWL_API_URL}/api/prompts/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PROMPTOWL_API_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `HTTP ${response.status}: Failed to create agent`);
        }

        const result = await response.json();

        return {
          content: [
            {
              type: "text",
              text: `✅ Agent created successfully!

**Name:** ${name}
**ID:** ${result.promptId}
**URL:** ${result.url}

The agent has been created in draft mode. You can:
- Test it in the PromptOwl UI
- Refine the instructions and configuration
- Activate it when ready (set isLive: true)
- Share it with your team
- Deploy it via API`,
            },
          ],
        };
      }

      case "list_agents": {
        const { limit, offset, tags } = args as any;

        const params = new URLSearchParams();
        if (limit) params.append("limit", limit.toString());
        if (offset) params.append("offset", offset.toString());
        if (tags && Array.isArray(tags) && tags.length > 0) {
          params.append("tags", tags.join(","));
        }

        const url = `${PROMPTOWL_API_URL}/api/prompts/list${params.toString() ? `?${params.toString()}` : ""}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${PROMPTOWL_API_KEY}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `HTTP ${response.status}: Failed to list agents`);
        }

        const result = await response.json();

        if (result.prompts.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No agents found. Create your first agent with create_agent!",
              },
            ],
          };
        }

        const agentsList = result.prompts
          .map((p: any) => {
            const tagsStr = p.tags && p.tags.length > 0 ? ` [${p.tags.join(", ")}]` : "";
            const statusStr = p.isLive ? "🟢" : "⚪";
            return `${statusStr} **${p.name}** (${p._id})${tagsStr}\n   ${p.description || "No description"}\n   Mode: ${p.runMode} | Updated: ${new Date(p.updatedAt).toLocaleDateString()}`;
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `📋 Your PromptOwl Agents (${result.total} total, showing ${result.prompts.length})\n\n${agentsList}\n\n🟢 = Live | ⚪ = Draft`,
            },
          ],
        };
      }

      case "get_agent": {
        const { promptId } = args as any;

        const response = await fetch(`${PROMPTOWL_API_URL}/api/prompts/${promptId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${PROMPTOWL_API_KEY}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `HTTP ${response.status}: Failed to get agent`);
        }

        const result = await response.json();
        const prompt = result.prompt;

        const details = `📝 Agent Details

**Name:** ${prompt.name}
**ID:** ${prompt._id}
**Status:** ${prompt.isLive ? "🟢 Live" : "⚪ Draft"}
**Run Mode:** ${prompt.runMode}
**Description:** ${prompt.description || "None"}
**Tags:** ${prompt.tags && prompt.tags.length > 0 ? prompt.tags.join(", ") : "None"}

**LLM Configuration:**
- Provider: ${prompt.llmType}
- Model: ${prompt.llmSettings?.model || "Not specified"}
- Temperature: ${prompt.llmSettings?.temperature ?? "Not specified"}

**Blocks:** ${prompt.blocks?.length || 0}
${prompt.blocks?.map((b: any, i: number) => `  ${i + 1}. ${b.name} (${b.variations?.length || 0} variations)`).join("\n") || "  None"}

**Variables:** ${Object.keys(prompt.variables || {}).length > 0 ? Object.keys(prompt.variables).join(", ") : "None"}

**Created:** ${new Date(prompt.createdAt).toLocaleString()}
**Updated:** ${new Date(prompt.updatedAt).toLocaleString()}`;

        return {
          content: [
            {
              type: "text",
              text: details,
            },
          ],
        };
      }

      case "export_agent_markdown": {
        const { promptId } = args as any;

        const response = await fetch(`${PROMPTOWL_API_URL}/api/prompts/${promptId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${PROMPTOWL_API_KEY}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `HTTP ${response.status}: Failed to get agent`);
        }

        const result = await response.json();
        const prompt = result.prompt;

        // Convert to Claude Code agent format
        const markdown = `---
name: ${prompt.name.toLowerCase().replace(/\s+/g, "-")}
description: ${prompt.description || prompt.name}
---

# ${prompt.name}

${prompt.description ? `## Description\n${prompt.description}\n\n` : ""}## Instructions

${prompt.blocks?.map((block: any) => {
  const mainVariation = block.variations?.[0];
  return mainVariation?.text || "";
}).join("\n\n") || "No instructions"}

${Object.keys(prompt.variables || {}).length > 0 ? `## Variables

${Object.entries(prompt.variables).map(([key, value]) => `- \`{{${key}}}\`: ${value || "User input"}`).join("\n")}` : ""}

${prompt.tags && prompt.tags.length > 0 ? `## Tags

${prompt.tags.join(", ")}` : ""}

## Configuration

- **Run Mode:** ${prompt.runMode}
- **LLM Provider:** ${prompt.llmType}
- **Model:** ${prompt.llmSettings?.model || "Default"}
- **Temperature:** ${prompt.llmSettings?.temperature ?? 0.7}
`;

        return {
          content: [
            {
              type: "text",
              text: `📄 Agent exported as Claude Code markdown format:\n\n\`\`\`markdown\n${markdown}\n\`\`\`\n\nSave this to \`.claude/agents/${prompt.name.toLowerCase().replace(/\s+/g, "-")}.md\``,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PromptOwl MCP Server running on stdio");
  console.error(`API URL: ${PROMPTOWL_API_URL}`);
  console.error("Ready to create and manage agents!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

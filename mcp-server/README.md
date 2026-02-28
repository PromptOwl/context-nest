# PromptOwl MCP Server

Model Context Protocol server for PromptOwl - Create and manage AI agents directly from Claude Code.

## Installation

### NPM Package (Coming Soon)

```bash
npx @promptowl/mcp-server
```

### Local Development

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

Add to your Claude Code configuration (`.mcp-servers.json` or similar):

```json
{
  "promptowl": {
    "command": "node",
    "args": ["/path/to/promptowl/mcp-server/dist/index.js"],
    "env": {
      "PROMPTOWL_API_KEY": "po_user_your_key_here",
      "PROMPTOWL_API_URL": "https://app.promptowl.ai"
    }
  }
}
```

Or using npx (when published):

```json
{
  "promptowl": {
    "command": "npx",
    "args": ["-y", "@promptowl/mcp-server"],
    "env": {
      "PROMPTOWL_API_KEY": "po_user_your_key_here"
    }
  }
}
```

## Getting Your API Key

1. Log into PromptOwl at https://app.promptowl.ai
2. Go to Settings → API Keys
3. Click "Generate New API Key"
4. Give it a name (e.g., "Claude Code Integration")
5. Copy the key (starts with `po_user_`)
6. Add it to your MCP server configuration

**⚠️ Important:** Keep your API key secure! Never commit it to version control.

## Available Tools

### create_agent

Create a new PromptOwl agent with specified configuration.

**Required Parameters:**
- `name` (string): Name of the agent
- `instructions` (string): System instructions defining the agent's behavior

**Optional Parameters:**
- `description` (string): What the agent does
- `runMode` (string): `default`, `sequential`, or `supervisor`
- `variables` (object): Input variables as key-value pairs
- `tags` (array): Tags for categorization
- `llmType` (string): LLM provider (`claude`, `openai`, `gemini`, `groq`)
- `model` (string): Specific model to use
- `temperature` (number): 0-2, controls randomness

**Example:**

```
Create a code security reviewer agent in PromptOwl with:
- Name: "Security Code Reviewer"
- Instructions: "You are an expert security auditor. Review code for vulnerabilities..."
- Variables: code and language
- Tags: security, code-review
```

### list_agents

List all your PromptOwl agents.

**Optional Parameters:**
- `limit` (number): Maximum results to return (default: 50)
- `offset` (number): Skip N results for pagination
- `tags` (array): Filter by tags

**Example:**

```
List my PromptOwl agents tagged with "security"
```

### get_agent

Get full details of a specific agent.

**Required Parameters:**
- `promptId` (string): The agent ID

**Example:**

```
Get details of PromptOwl agent 507f1f77bcf86cd799439011
```

### export_agent_markdown

Export an agent as Claude Code compatible markdown.

**Required Parameters:**
- `promptId` (string): The agent ID to export

**Example:**

```
Export PromptOwl agent 507f1f77bcf86cd799439011 as markdown
```

## Usage Examples

### From Claude Code

Simply talk to Claude naturally:

```
User: "Create a code reviewer agent in PromptOwl that checks for security issues"

Claude: I'll create that agent for you in PromptOwl.
[calls create_agent tool]

Response: ✅ Agent created successfully!
Name: Code Security Reviewer
ID: 507f1f77bcf86cd799439011
URL: https://app.promptowl.ai/prompt/edit/507f1f77bcf86cd799439011
```

### Advanced Examples

**Multi-variable Agent:**
```
Create a document analyzer agent in PromptOwl with:
- Variables for document_text and analysis_type
- Tags: analysis, documents
- Temperature: 0.3 for consistent results
```

**Sequential Workflow:**
```
Create a research assistant agent with runMode "sequential" that:
1. Searches for information
2. Analyzes findings
3. Writes a summary
```

**List and Filter:**
```
Show me all my PromptOwl agents tagged with "production"
```

**Export for Sharing:**
```
Export my "API Documentation Generator" agent as markdown so I can share it
```

## Development Workflow

The recommended workflow for PromptOwl + Claude Code:

1. **Prototype in Claude Code**: Create agents quickly using natural language
2. **Refine in PromptOwl UI**: Test, add variables, configure settings
3. **Activate & Deploy**: Set isLive=true and use via API or chatbot
4. **Export & Share**: Export as markdown to share with team

## Features

- 🚀 **Fast Creation**: Build agents in seconds from Claude Code
- 🔒 **Secure**: API key authentication, encrypted storage
- 📊 **Full Control**: Access all PromptOwl features programmatically
- 🔄 **Bidirectional**: Create in Claude Code, refine in PromptOwl UI
- 📤 **Export**: Share agents as Claude Code markdown files
- 🏷️ **Organized**: Tag and filter your agent library

## Troubleshooting

### "PROMPTOWL_API_KEY environment variable is required"

Make sure your API key is set in the MCP server configuration.

### "Invalid or inactive API key"

- Check that your API key is correct
- Verify the key is active in PromptOwl settings
- Ensure the key hasn't been deleted or deactivated

### "Agent not found"

- Verify the prompt ID is correct
- Ensure you have permission to access the agent
- Check that the agent hasn't been deleted

## API Endpoints Used

This MCP server communicates with:

- `POST /api/prompts/create` - Create agents
- `GET /api/prompts/list` - List agents
- `GET /api/prompts/{id}` - Get agent details

## Support

- Documentation: https://app.promptowl.ai/docs
- Issues: https://github.com/promptowl/promptowl-mcp-server/issues
- Email: support@promptowl.ai

## License

MIT

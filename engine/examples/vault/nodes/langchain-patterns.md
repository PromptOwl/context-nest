---
id: ulid:01JCQM2K7X8PQR5TVWXYZ12355
title: "LangChain Implementation Patterns"
type: snippet
owners:
  - team:engineering
  - user:misha
scope: team
tags:
  - "#snippet"
  - "#code"
  - "#langchain"
  - "#ai"
  - "#developer"
permissions:
  read:
    - team:engineering
    - role:developer
  write:
    - team:engineering
  export:
    - role:developer
version: 1
created_at: "2025-10-20T16:00:00Z"
updated_at: "2025-10-28T09:30:00Z"
derived_from: []
checksum: "sha256:stu901vwx234567890123456789012345678901234567890123456789012"
metadata:
  word_count: 800
  token_count: 1200
  last_reviewed: "2025-10-28"
  review_cycle_days: 60
  language: typescript
---

# LangChain Implementation Patterns

Common patterns and code snippets for working with LangChain in PromptOwl.

## Basic Chat Model Initialization

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

// OpenAI
const openai = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY,
});

// Anthropic Claude
const anthropic = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.7,
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

## RAG with Vector Store

```typescript
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";

// Initialize vector store
const vectorStore = await QdrantVectorStore.fromExistingCollection(
  new OpenAIEmbeddings(),
  {
    url: process.env.QDRANT_URL,
    collectionName: "artifacts",
  }
);

// Search for relevant context
const retriever = vectorStore.asRetriever({
  k: 5,
  searchType: "similarity",
});

const relevantDocs = await retriever.getRelevantDocuments(userQuery);

// Inject into prompt
const context = relevantDocs.map(doc => doc.pageContent).join("\n\n");
const prompt = `Context:\n${context}\n\nQuestion: ${userQuery}`;
```

## Tool Binding with MCP

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";

// Define custom tool
const calculatorTool = new DynamicStructuredTool({
  name: "calculator",
  description: "Performs mathematical calculations",
  schema: z.object({
    expression: z.string().describe("Mathematical expression to evaluate"),
  }),
  func: async ({ expression }) => {
    try {
      const result = eval(expression);
      return `Result: ${result}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
});

// Bind tools to model
const modelWithTools = model.bindTools([calculatorTool, searchTool]);

// Invoke with tool support
const response = await modelWithTools.invoke([
  { role: "user", content: "What is 25 * 4?" }
]);

// Check for tool calls
if (response.tool_calls && response.tool_calls.length > 0) {
  const toolCall = response.tool_calls[0];
  const toolResult = await calculatorTool.invoke(toolCall.args);
}
```

## LangGraph State Management

```typescript
import { StateGraph, Annotation } from "@langchain/langgraph";

// Define state schema
const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  context: Annotation<string>(),
  citations: Annotation<Citation[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

// Create graph
const workflow = new StateGraph(GraphState)
  .addNode("retrieve", retrieveNode)
  .addNode("generate", generateNode)
  .addEdge("__start__", "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", "__end__");

const app = workflow.compile();

// Execute workflow
const result = await app.invoke({
  messages: [{ role: "user", content: userQuery }],
});
```

## Streaming Responses

```typescript
import { StreamingTextResponse } from "ai";

// Create streaming chain
const chain = prompt.pipe(model).pipe(parser);

// Stream to client
const stream = await chain.stream({
  input: userMessage,
  context: retrievedContext,
});

// Convert to web stream
const encoder = new TextEncoder();
const readableStream = new ReadableStream({
  async start(controller) {
    for await (const chunk of stream) {
      controller.enqueue(encoder.encode(chunk));
    }
    controller.close();
  },
});

return new StreamingTextResponse(readableStream);
```

## Error Handling

```typescript
import { formatModelError } from "@/lib/langChainHelper";

try {
  const response = await model.invoke(messages);
  return response.content;
} catch (error) {
  // Format error for user display
  const formattedError = formatModelError(error);

  // Log for debugging
  console.error("LLM Error:", {
    message: formattedError.message,
    provider: model.model,
    timestamp: new Date().toISOString(),
  });

  // Return user-friendly message
  return {
    error: true,
    message: formattedError.userMessage,
    details: formattedError.technicalDetails,
  };
}
```

## Conditional Routing

```typescript
// Route based on tool calls
function shouldContinue(state: typeof GraphState.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];

  // If model called tools, route to tool node
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "tools";
  }

  // Otherwise, end workflow
  return "__end__";
}

// Add conditional edge
workflow.addConditionalEdges(
  "agent",
  shouldContinue,
  {
    tools: "tools",
    __end__: "__end__",
  }
);
```

## Prompt Templates

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";

const template = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful AI assistant. Use this context:\n{context}"],
  ["human", "{input}"],
]);

// Format with variables
const formatted = await template.format({
  context: relevantDocs,
  input: userQuery,
});

// Or invoke directly
const response = await template.pipe(model).invoke({
  context: relevantDocs,
  input: userQuery,
});
```

## Memory Management

```typescript
import { BufferMemory } from "langchain/memory";

// Create memory buffer
const memory = new BufferMemory({
  returnMessages: true,
  memoryKey: "chat_history",
});

// Save context
await memory.saveContext(
  { input: userMessage },
  { output: assistantResponse }
);

// Load history
const history = await memory.loadMemoryVariables({});
const messages = history.chat_history;
```

## Production Best Practices

### 1. Always set timeouts
```typescript
const model = new ChatOpenAI({
  timeout: 30000, // 30 seconds
  maxRetries: 2,
});
```

### 2. Use structured outputs
```typescript
const schema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()),
});

const result = await model.withStructuredOutput(schema).invoke(prompt);
```

### 3. Monitor token usage
```typescript
const response = await model.invoke(messages);
console.log("Token usage:", {
  prompt: response.usage_metadata?.input_tokens,
  completion: response.usage_metadata?.output_tokens,
  total: response.usage_metadata?.total_tokens,
});
```

### 4. Implement fallbacks
```typescript
const primaryModel = new ChatOpenAI({ modelName: "gpt-4o" });
const fallbackModel = new ChatOpenAI({ modelName: "gpt-3.5-turbo" });

try {
  return await primaryModel.invoke(messages);
} catch (error) {
  console.warn("Primary model failed, using fallback");
  return await fallbackModel.invoke(messages);
}
```

## Related Documentation

- [LangChain Docs](https://js.langchain.com/docs)
- [PromptOwl LangChain Integration](lib/callLangchain.ts)
- [Tool Integration Guide](lib/metamcp-tools.ts)

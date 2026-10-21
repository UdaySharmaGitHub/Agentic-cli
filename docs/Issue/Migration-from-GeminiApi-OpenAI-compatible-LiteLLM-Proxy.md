# Migration: Replace Gemini API with OpenAI-Compatible API (LiteLLM Proxy support)

## Summary

The project currently uses Google's `@google/generative-ai` SDK exclusively. This issue tracks replacing it with the `openai` npm package configured to point at any OpenAI-compatible endpoint — including LiteLLM Proxy, OpenAI directly, or any other drop-in provider — via two environment variables: `BASE_URL` and `API_KEY`.

**Branch naming convention:** `feat/migrate-gemini-to-openai-compatible` (or follow the project convention, e.g. `feature/openai-compatible-api`, `feat/litellm-proxy-support`)

---

## Motivation

- **Vendor lock-in**: the current code is tightly coupled to Gemini-specific types (`GoogleGenerativeAI`, `FunctionDeclaration`, `SchemaType`, `Content`, `Part`). Switching providers requires a full rewrite today.
- **LiteLLM Proxy**: teams running a self-hosted [LiteLLM](https://docs.litellm.ai/) proxy can route to Gemini, GPT-4o, Claude, Mistral, or any other model behind a single OpenAI-compatible surface. The current code cannot use that proxy at all.
- **OpenAI ecosystem**: the `openai` SDK's streaming + tool-calling interface is the de-facto standard; tooling, examples, and community support are much richer.

---

## Current State

### Environment (`.env.example`)

```env
GEMINI_API_KEY=
```

### SDK dependency (`package.json`)

```json
"@google/generative-ai": "^0.x.x"
```

### `src/gemini.ts`

- Creates a `GoogleGenerativeAI` client with `apiKey`.
- Converts our `ToolDefinition[]` to Gemini `FunctionDeclaration[]` using a custom `SchemaType` map.
- Streams with `genModel.generateContentStream()`.
- Returns a bespoke `GeminiResponse` with `parts: Part[]` and `functionCalls[]`.

### `src/agent.ts`

- Imports `GoogleGenerativeAI` from `@google/generative-ai`.
- Pushes `{ role: 'model', parts: [...] }` / `{ role: 'user', parts: [functionResponse] }` to the history.
- Checks `response.functionCalls.length === 0` to detect task completion.

### `src/index.ts`

- Reads `GEMINI_API_KEY` from env / setup wizard.
- Calls `createClient(apiKey)` from `gemini.ts`.
- Exposes `process.env.GEMINI_API_KEY` and `process.env.GEMINI_MODEL`.

### `src/config.ts`

```ts
export const DEFAULT_MODEL = 'gemini-2.5-flash';
```

---

## Target State

### Environment (`.env.example`)

```env
# Required — your provider API key (Gemini, OpenAI, or LiteLLM master key)
API_KEY=

# Optional — defaults to https://api.openai.com/v1
# For LiteLLM Proxy: http://localhost:4000   (or your hosted proxy URL)
# For Gemini via LiteLLM: https://litellm.example.com
BASE_URL=
```

### SDK dependency (`package.json`)

Replace `@google/generative-ai` with:

```json
"openai": "^4.x.x"
```

### New `src/openai.ts` (replaces `src/gemini.ts`)

```ts
import OpenAI from 'openai';
import type {
  ChatCompletionTool,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import type { ChatMessage, ToolCall } from './memory.js';
import { getToolDefinitions } from './tools/index.js';
import type { ToolDefinition } from './tools/types.js';

// ── Convert ToolDefinition → ChatCompletionTool ──────────────────────────────

function toChatCompletionTools(tools: ToolDefinition[]): ChatCompletionTool[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object' as const,
        properties: Object.fromEntries(
          Object.entries(t.parameters.properties).map(([key, val]) => [
            key,
            { type: val.type, description: val.description },
          ]),
        ),
        required: t.parameters.required,
      },
    },
  }));
}

// ── Create an OpenAI-compatible client ───────────────────────────────────────

export function createClient(_model: string): OpenAI {
  return new OpenAI({
    apiKey: process.env.API_KEY ?? '',
    baseURL: process.env.BASE_URL?.trim() ?? 'https://api.openai.com/v1',
  });
}

// ── Response types ───────────────────────────────────────────────────────────

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  text: string;
  toolCalls: ToolCall[];
  usage?: TokenUsage;
}

// ── Stream a chat completion and return structured response ──────────────────

export async function streamMessage(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<LLMResponse> {
  const allMessages: ChatCompletionMessageParam[] = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    ...messages as ChatCompletionMessageParam[],
  ];

  const tools = toChatCompletionTools(getToolDefinitions());

  const stream = await client.chat.completions.create(
    {
      model,
      messages: allMessages,
      tools,
      tool_choice: 'auto',
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 8192,
      temperature: 0.3,
    },
    { signal },
  );

  let fullText = '';
  const toolCallChunksMap = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();
  let usage: TokenUsage | undefined;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    if (delta?.content) {
      onText(delta.content);
      fullText += delta.content;
    }

    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const existing = toolCallChunksMap.get(tc.index);
        if (existing) {
          if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          if (tc.function?.name) existing.name += tc.function.name;
        } else {
          toolCallChunksMap.set(tc.index, {
            id: tc.id ?? '',
            name: tc.function?.name ?? '',
            arguments: tc.function?.arguments ?? '',
          });
        }
      }
    }

    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
        totalTokens: chunk.usage.total_tokens,
      };
    }
  }

  const toolCalls: ToolCall[] = Array.from(toolCallChunksMap.values()).map(tc => ({
    id: tc.id,
    type: 'function' as const,
    function: { name: tc.name, arguments: tc.arguments },
  }));

  return { text: fullText, toolCalls, usage };
}
```

### Updated `src/memory.ts`

The current `memory.ts` uses Gemini-specific `Part` / `MessageParam` types. These must be replaced with OpenAI `ChatCompletionMessageParam` (or a thin internal alias) so that tool call results flow back as `role: 'tool'` messages — the format OpenAI-compatible APIs expect.

Key mapping:

| Gemini concept | OpenAI equivalent |
|---|---|
| `{ role: 'model', parts: [{text}] }` | `{ role: 'assistant', content: text }` |
| `{ role: 'user', parts: [{functionResponse}] }` | `{ role: 'tool', tool_call_id, content: result }` |
| `{ role: 'user', parts: [{text}] }` | `{ role: 'user', content: text }` |

### Updated `src/agent.ts`

- Remove `import type { GoogleGenerativeAI }` → import `OpenAI` from `openai`.
- Import `streamMessage` from `./openai.js`.
- Replace the `functionCalls` check with `response.toolCalls.length === 0`.
- Rebuild the tool-result history entries as `role: 'tool'` messages.

### Updated `src/index.ts`

- Read `API_KEY` (and optionally `BASE_URL`) instead of `GEMINI_API_KEY`.
- Update the setup wizard prompt label from "Gemini API Key" → "API Key".
- Pass `model` string to `createClient(model)` (the client itself is stateless w.r.t. model).
- Expose `process.env.API_KEY` and `process.env.BASE_URL` for tools.

### Updated `src/config.ts`

```ts
// Default model when using OpenAI directly; for LiteLLM set --model to your
// proxy model name (e.g. "gemini/gemini-2.5-flash" or "gpt-4o")
export const DEFAULT_MODEL = 'gpt-4o-mini';
```

---

## Files Changed

| File | Action |
|---|---|
| `src/gemini.ts` | **Delete** (replaced by `src/openai.ts`) |
| `src/openai.ts` | **Create** |
| `src/agent.ts` | **Update** — swap Gemini types/imports for OpenAI equivalents |
| `src/memory.ts` | **Update** — replace Gemini `Part`/`MessageParam` with OpenAI message shapes |
| `src/index.ts` | **Update** — env var names, wizard labels, `createClient` call |
| `src/config.ts` | **Update** — `DEFAULT_MODEL` |
| `.env.example` | **Update** — `GEMINI_API_KEY` → `API_KEY` + add `BASE_URL` |
| `package.json` | **Update** — remove `@google/generative-ai`, add `openai` |

---

## LiteLLM Proxy Quick-Start

```bash
# 1. Install and start LiteLLM with Gemini backend
pip install litellm
litellm --model gemini/gemini-2.5-flash --api_key $GEMINI_API_KEY

# 2. Set env vars for this CLI
export API_KEY=any-string          # LiteLLM accepts any non-empty key by default
export BASE_URL=http://localhost:4000

# 3. Run the agent
pnpm dev --model gemini/gemini-2.5-flash
```

To use OpenAI directly (no proxy):

```bash
export API_KEY=sk-...
# BASE_URL defaults to https://api.openai.com/v1
pnpm dev --model gpt-4o
```

---

## Acceptance Criteria

- [ ] `src/gemini.ts` and its `@google/generative-ai` import are removed.
- [ ] `API_KEY` + optional `BASE_URL` replace `GEMINI_API_KEY` everywhere (env, wizard, docs).
- [ ] Tool calls round-trip correctly via `role: 'tool'` messages (not Gemini `functionResponse` parts).
- [ ] Streaming text output is unchanged from the user's perspective.
- [ ] `--model` flag accepts any model string the backend understands (e.g. `gpt-4o`, `gemini/gemini-2.5-flash`).
- [ ] A LiteLLM Proxy pointed at Gemini passes an end-to-end agent turn with at least one tool call.
- [ ] Existing TypeScript build (`pnpm build`) passes with no errors.

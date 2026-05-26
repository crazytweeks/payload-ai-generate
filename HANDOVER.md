# AI Composer — Full Handover Document

> **Purpose**: Drop this file into any Claude session and say "implement the plan in COMPOSER_HANDOVER.md". It contains the full original request, codebase analysis, and step-by-step implementation plan — everything needed to continue without the prior conversation.

---

## Original User Request (verbatim summary)

> We were working on the `feature/ai-generate` branch (now merged to main). We want a fully dedicated AI Composer page and separate custom endpoint in the plugin.
>
> - Create a **new `ai-composer` collection** — a duplicate starting point from `ai-prompts`, but stripped down. Remove all the html/css/js/json data output fields. Keep it simple: user gives a **first prompt**, then subsequent prompts are **messages**. So: array of messages + first prompt.
> - **How AI works here**: AI takes input, analyses available data, then based on that data (after tool calls if necessary), creates a clean UI generation **plan** — covering design, approach, data mapping, all planning details. This plan is shown in the composer UI.
> - **On the UI**: show live chat — AI thinking, reasoning, tool callings — all live-streamed to the UI. And the planning output.
> - **Install Tailwind v4** on `packages/ai-generate/dev` so we can use Tailwind classes. Clean and easy-looking UI.
> - **Use AI SDK properly** — use `useChat` from `@ai-sdk/react`, not manual fetch/NDJSON.
> - **Add AI SDK Dev Tools** so we can see what's going on during development.
> - **Build server functions in a reusable way** — so they can later be used by other apps (`apps/lex`, `apps/erp`, `apps/web`) without relying on Payload CMS custom endpoints.

---

## Codebase Analysis

### Repository Structure

```
packages/ai-generate/          ← git submodule at github.com/crazytweeks/payload-ai-generate
├── src/                       ← plugin source (published as npm: payload-ai-generate)
│   ├── ai-types.ts            ← all shared types
│   ├── aiService.ts           ← barrel re-export
│   ├── index.ts               ← main plugin entry + Payload registration
│   ├── collections/
│   │   ├── constants.ts       ← slug constants
│   │   ├── prompt.ts          ← ai-prompts collection (DO NOT TOUCH)
│   │   ├── preset.ts          ← ai-presets collection
│   │   ├── models.ts          ← ai-models-options collection
│   │   └── shared.ts          ← model sync utilities
│   ├── ai-service/
│   │   ├── provider-runner.ts ← createPromptRunner + aiServiceCreate (Google + OpenAI)
│   │   ├── block-stream.ts    ← createBlockStreamGenerator (core streaming engine)
│   │   ├── options.ts         ← resolveOptions (fills env vars)
│   │   ├── payload.ts         ← installPayloadAI / resolvePayloadAI
│   │   └── stream-utils.ts    ← truncateSummary, extractJSONObjectCandidate, EventQueue
│   ├── block-generation/      ← html/css/js block generation logic (DO NOT TOUCH)
│   ├── endpoints/
│   │   ├── customEndpointHandler.ts   ← POST /ai-generate/stream (DO NOT TOUCH)
│   │   ├── previewHandler.ts          ← GET /ai-generate/preview (DO NOT TOUCH)
│   │   └── custom-handler/
│   │       ├── handler.ts     ← main request orchestration
│   │       ├── preset.ts      ← resolvePresetValues, resolvePresetModelId
│   │       ├── stream-response.ts ← streamEventsResponse, collectFinalPayload
│   │       ├── attachments.ts ← resolveAttachmentDoc, buildInputMessages
│   │       └── types.ts       ← GenerateRequestBody, ResolvedAttachment
│   ├── tools/
│   │   ├── contextTools.ts    ← createContextTools (read_file, read_folder)
│   │   └── referenceTools.ts  ← createReferenceTools (fetch_reference_docs)
│   └── components/ai-composer/ ← Payload Admin UI composer field (DO NOT TOUCH)
└── dev/                       ← Next.js dev app (NOT a separate package, uses plugin root package.json)
    ├── app/
    │   ├── (frontend)/
    │   │   ├── layout.tsx     ← frontend layout (needs Tailwind + DevTools added)
    │   │   ├── composer/
    │   │   │   ├── page.tsx           ← server component (needs update for ai-composer)
    │   │   │   └── ComposerClient.tsx ← full rewrite needed
    │   │   └── posts/
    │   ├── (payload)/api/[...slug]/route.ts ← Payload REST catchall (Payload endpoints go here)
    │   └── next/preview/route.ts
    ├── components/
    │   └── LivePreviewListener.tsx
    ├── next.config.mjs        ← withPayload wrapper, no Tailwind yet
    ├── payload.config.ts      ← MongoDB, plugin wired up with dev test collections
    └── globals.css            ← NEEDS TO BE CREATED with @import "tailwindcss"
```

### Key Existing Types (`src/ai-types.ts`)

```ts
// Provider types
type AIProviderName = 'google' | 'openai'

// Conversation
type AIConversationMessage = {
  content: string
  createdAt: string
  metadata?: { modelId?, outcome?, provider?, repairAttempt?, source? }
  role: 'user' | 'assistant' | 'system'
}

// Reference data source (used in prompts referenceCollections field)
type AIReferenceDataSource = {
  collection: string
  dataLoading: 'server' | 'client'
  filtersJSON?: string
  isBeingUsed: boolean
  limit: number
}

// Plugin options
type AIPluginOptions = {
  googleApiKey?: string
  openaiApiKey?: string
  defaultProvider?: AIProviderName
  referenceCollections?: Record<string, boolean>
  // ... and more
}
```

### How Existing Streaming Works (for reference)

The existing `POST /api/ai-generate/stream` endpoint:
1. Parses `GenerateRequestBody` from POST JSON
2. Builds prompt via `buildAiHtmlPrompt()`
3. Creates reference tools via `createReferenceTools()`
4. Calls `payloadAI.streamBlockGeneration()` → returns `AsyncIterable<AIGenerationEvent>`
5. Returns NDJSON via `streamEventsResponse()`

The current `ComposerClient.tsx` uses **manual fetch + NDJSON parsing** — we are replacing this with `useChat` from `@ai-sdk/react`.

### Important Constraints (from DEVELOPMENT_INSTRUCTIONS.md)

- **Bun only** — never use npm/npx/pnpm. Commands: `bun`, `bunx`
- **Live dev server on tmux `tx dev` at port 4000** — never kill/restart it. Hot reload is active.
- **Plugin git history** goes to the submodule repo — commit from inside `packages/ai-generate/`, not from monorepo root
- After plugin commits, update the monorepo pointer: `cd ../.. && git add packages/ai-generate && git commit -m "chore: update ai-generate submodule"`
- **No comments** unless the WHY is non-obvious
- **No unused variables** — TypeScript strict + Biome will fail

### Package Info

- **Plugin package name**: `payload-ai-generate`
- **Version**: `0.1.1-beta.1`
- **Type**: `"module"` (ESM)
- **Runtime deps**: `@ai-sdk/google`, `@ai-sdk/openai`, `ai`, `zod`, `@payloadcms/live-preview-react`
- **Dev app stack**: Next.js 16 + React 19 + Payload 3.84 + MongoDB
- **No Tailwind installed yet**

---

## Implementation Plan

### Overview

Build a new `ai-composer` system with these parts:

1. **`ai-composer` Payload collection** — simple schema (title, firstPrompt, messages, plan, referenceCollections, preset)
2. **`src/composer/`** — reusable core functions (types, prompt builders, `streamComposerGeneration`)
3. **`src/endpoints/composerEndpointHandler.ts`** — Payload endpoint registering `POST /ai-generate/composer`
4. **Tailwind v4** — install in dev app, create globals.css, postcss config
5. **`dev/app/api/ai-generate/composer/route.ts`** — Next.js API route using AI SDK's `toDataStreamResponse` for `useChat`
6. **New `ComposerClient.tsx`** — 3-column layout, Tailwind v4, `useChat` from `@ai-sdk/react`
7. **AI SDK Dev Tools** — via `@ai-sdk/react` devtools, wired in layout

---

### Step 1 — Install Tailwind v4

Run from `packages/ai-generate/` (no separate dev/package.json):

```bash
bun add -D tailwindcss @tailwindcss/postcss
```

Also install `@ai-sdk/react` (needed for `useChat`):

```bash
bun add @ai-sdk/react
```

---

### Step 2 — Create Tailwind config files

**Create `dev/postcss.config.mjs`:**
```js
export default { plugins: { '@tailwindcss/postcss': {} } }
```

**Create `dev/globals.css`:**
```css
@import "tailwindcss";

/* Dark theme CSS variables for the composer */
:root {
  --bg-base: #0f0f11;
  --bg-panel: #18181b;
  --bg-input: #09090b;
  --border: #27272a;
  --text-primary: #e2e2e8;
  --text-muted: #a1a1aa;
  --accent: #7c3aed;
  --accent-hover: #6d28d9;
}
```

---

### Step 3 — Update `dev/app/(frontend)/layout.tsx`

Import globals.css and add AI SDK DevTools:

```tsx
import '../../../dev/globals.css'  // adjust relative path as needed
```

Actually: the layout is at `dev/app/(frontend)/layout.tsx`, so the import path to `dev/globals.css` would be `'../../globals.css'`.

Add `<AISDKDevTools />` from `@ai-sdk/react/devtools` — check the actual export name by looking at `node_modules/@ai-sdk/react` after install. The component is typically `<AISDKDevTools />` and it renders a floating panel only in development.

---

### Step 4 — Add `aiComposerCollectionSlug` to constants

**File: `src/collections/constants.ts`**

Add:
```ts
export const aiComposerCollectionSlug = 'ai-composer' as const
```

---

### Step 5 — Create `src/collections/composer.ts`

This is a new collection, **not modifying `prompt.ts`**. Reuse `buildReferenceCollectionFields` from `prompt.ts`.

```ts
import type { CollectionConfig } from 'payload'
import type { AIPluginOptions } from '../ai-types'
import { aiComposerCollectionSlug, aiPresetCollectionSlug } from './constants'

// Import the reference fields builder from prompt.ts
// (It's not exported yet — we need to either export it or duplicate it)
// Best approach: extract buildReferenceCollectionFields to shared.ts or duplicate it here

export const buildAIComposerCollection = (pluginOptions: AIPluginOptions): CollectionConfig => ({
  slug: aiComposerCollectionSlug,
  admin: {
    group: 'AI',
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'firstPrompt',
      type: 'textarea',
      required: true,
      admin: {
        rows: 6,
        description: 'The initial prompt that starts this composition session.',
      },
    },
    {
      name: 'preset',
      type: 'relationship',
      relationTo: aiPresetCollectionSlug,
      admin: {
        description: 'Optional AI preset defining model, provider, and system prompt.',
      },
    },
    // referenceCollections array — same shape as in ai-prompts
    // Copy the buildReferenceCollectionFields logic here, or export it from prompt.ts
    // See prompt.ts lines 30-120 for the full field definition
    {
      name: 'referenceCollections',
      type: 'array',
      admin: {
        description: 'Optional reference collection queries for AI context.',
        condition: () => Object.keys(pluginOptions.referenceCollections ?? {}).length > 0,
      },
      fields: [
        {
          name: 'collection',
          type: 'select',
          options: Object.entries(pluginOptions.referenceCollections ?? {})
            .filter(([, enabled]) => enabled)
            .map(([slug]) => ({ label: slug, value: slug })),
          required: true,
        },
        {
          name: 'limit',
          type: 'number',
          defaultValue: 10,
          min: 1,
          required: true,
        },
        {
          name: 'isBeingUsed',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'dataLoading',
          type: 'select',
          defaultValue: 'server',
          options: [
            { label: 'Server', value: 'server' },
            { label: 'Client', value: 'client' },
          ],
          required: true,
        },
        {
          name: 'filtersJSON',
          type: 'code',
          admin: { language: 'json' },
        },
      ],
    },
    // Hidden storage fields
    {
      name: 'messages',
      type: 'json',
      defaultValue: [],
      admin: { hidden: true, readOnly: true },
    },
    {
      name: 'plan',
      type: 'json',
      admin: { hidden: true, readOnly: true },
    },
  ],
})
```

---

### Step 6 — Export from `src/collections.ts`

Add to the existing collections barrel:
```ts
export { buildAIComposerCollection } from './collections/composer'
export { aiComposerCollectionSlug } from './collections/constants'
```

---

### Step 7 — Register in `src/index.ts`

```ts
import { buildAIComposerCollection } from './collections'
import { composerEndpointHandler } from './endpoints/composerEndpointHandler'

// In the aiGenerate plugin function, add:
config.collections = upsertCollection(
  config.collections,
  buildAIComposerCollection(effectivePluginOptions)
)

// In config.endpoints, add:
{
  handler: composerEndpointHandler,
  method: 'post',
  path: '/ai-generate/composer',
}
```

---

### Step 8 — Create `src/composer/types.ts`

```ts
import type { AIProviderName, AIReferenceDataSource } from '../ai-types'
import type { ToolSet } from 'ai'

export type ComposerMessage = {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type ComposerPlan = {
  design: string
  approach: string
  dataMapping: string
  components: string[]
  notes?: string
}

export type ComposerStreamParams = {
  firstPrompt: string
  messages: ComposerMessage[]
  references?: AIReferenceDataSource[]
  model?: string
  provider?: AIProviderName
  system?: string
  requestTools?: ToolSet
  abortSignal?: AbortSignal
}
```

---

### Step 9 — Create `src/composer/prompt.ts`

```ts
import type { AIReferenceDataSource } from '../ai-types'
import type { ComposerMessage } from './types'

export const buildComposerSystemPrompt = (): string => `
You are an expert UI/UX architect and frontend engineer.

Your role is to ANALYSE the user's request and available data, then produce a detailed UI PLAN.

Do NOT write code yet. Instead, think through:
1. What data is available (from reference collections and tool calls)
2. What the user actually needs
3. The best design approach — layout, visual hierarchy, interaction patterns
4. How to map the available data to UI components
5. Which components/patterns to use and why

After your analysis, output a JSON block with this exact structure:
\`\`\`json
{
  "design": "Description of the visual design approach, color scheme, layout structure",
  "approach": "Technical approach — component architecture, state management, rendering strategy",
  "dataMapping": "How the available data maps to UI elements",
  "components": ["Component1: description", "Component2: description"],
  "notes": "Any important caveats, open questions, or decisions that need user input"
}
\`\`\`

Before producing the plan, use available tools to fetch reference data. Reason through the problem step by step. Show your thinking.
`.trim()

export const buildComposerUserPrompt = ({
  firstPrompt,
  messages,
  references,
}: {
  firstPrompt: string
  messages: ComposerMessage[]
  references?: AIReferenceDataSource[]
}): string => {
  const parts: string[] = []

  parts.push(`TASK: ${firstPrompt}`)

  if (references && references.length > 0) {
    const active = references.filter(r => r.isBeingUsed && r.dataLoading !== 'client')
    if (active.length > 0) {
      parts.push(`\nAvailable reference data sources:\n${JSON.stringify(active, null, 2)}`)
      parts.push('Use fetch_reference_docs for each active source before planning.')
    }
  }

  if (messages.length > 0) {
    parts.push('\nConversation history:')
    messages.forEach(m => parts.push(`[${m.role}] ${m.content}`))
    parts.push('\nBased on the above conversation, update the plan accordingly.')
  }

  return parts.join('\n')
}
```

---

### Step 10 — Create `src/composer/stream.ts`

This is the **reusable core function**. It uses the existing `createPromptRunner` and `createReferenceTools` patterns but is self-contained.

```ts
import { streamText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { ToolSet } from 'ai'
import type { AIPluginOptions, AIProviderName } from '../ai-types'
import { resolveOptions } from '../ai-service/options'
import { buildComposerSystemPrompt, buildComposerUserPrompt } from './prompt'
import type { ComposerMessage, ComposerPlan, ComposerStreamParams } from './types'

const extractPlanFromText = (text: string): ComposerPlan | null => {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/i)
  if (!match?.[1]) return null
  try {
    return JSON.parse(match[1]) as ComposerPlan
  } catch {
    return null
  }
}

export const createComposerStreamGenerator = (pluginOptions: AIPluginOptions) => {
  const resolvedOptions = resolveOptions(pluginOptions)

  const google = resolvedOptions.googleApiKey
    ? createGoogleGenerativeAI({ apiKey: resolvedOptions.googleApiKey })
    : null

  const openai = resolvedOptions.openaiApiKey
    ? createOpenAI({ apiKey: resolvedOptions.openaiApiKey })
    : null

  const resolveModel = (provider: AIProviderName, model?: string) => {
    if (provider === 'google') {
      if (!google) throw new Error('Google API key not configured')
      return google(model ?? 'gemini-2.5-flash')
    }
    if (!openai) throw new Error('OpenAI API key not configured')
    return openai(model ?? 'gpt-4o-mini')
  }

  return async function* streamComposerGeneration({
    firstPrompt,
    messages,
    references,
    model,
    provider = resolvedOptions.defaultProvider ?? 'google',
    system,
    requestTools = {},
    abortSignal,
  }: ComposerStreamParams): AsyncGenerator<{ type: string; [key: string]: unknown }> {
    const resolvedModel = resolveModel(provider, model)
    const systemPrompt = system ?? buildComposerSystemPrompt()
    const userPrompt = buildComposerUserPrompt({ firstPrompt, messages, references })

    yield { type: 'status', stage: 'starting', message: 'Initialising AI composer...' }

    const result = streamText({
      model: resolvedModel,
      system: systemPrompt,
      prompt: userPrompt,
      tools: Object.keys(requestTools).length > 0 ? requestTools : undefined,
      maxSteps: 10,
      abortSignal,
    })

    yield { type: 'status', stage: 'thinking', message: 'Analysing request...' }

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        yield { type: 'text-delta', delta: chunk.textDelta }
      } else if (chunk.type === 'tool-call') {
        yield { type: 'status', stage: 'tool-calling', message: `Calling ${chunk.toolName}...` }
        yield { type: 'tool-call', toolName: chunk.toolName, args: chunk.args }
      } else if (chunk.type === 'tool-result') {
        yield { type: 'tool-result', toolName: chunk.toolName, result: chunk.result }
      } else if (chunk.type === 'reasoning') {
        yield { type: 'reasoning', text: chunk.textDelta }
      }
    }

    const fullText = await result.text
    const plan = extractPlanFromText(fullText)

    if (plan) {
      yield { type: 'plan-update', plan }

      const updatedMessages: ComposerMessage[] = [
        ...messages,
        { role: 'user', content: firstPrompt, createdAt: new Date().toISOString() },
        { role: 'assistant', content: fullText, createdAt: new Date().toISOString() },
      ]
      yield { type: 'final', plan, messages: updatedMessages }
    } else {
      yield { type: 'error', message: 'Could not extract plan from AI response.' }
    }

    yield { type: 'status', stage: 'done', message: 'Done.' }
  }
}
```

---

### Step 11 — Create `src/composer/index.ts`

```ts
export { createComposerStreamGenerator } from './stream'
export { buildComposerSystemPrompt, buildComposerUserPrompt } from './prompt'
export type { ComposerMessage, ComposerPlan, ComposerStreamParams } from './types'
```

---

### Step 12 — Create `src/endpoints/composerEndpointHandler.ts`

The Payload endpoint — wires the core function into the Payload plugin endpoint system. This is used when host apps like `lex`, `erp`, `web` call the AI composer via Payload's built-in API routes.

```ts
import type { PayloadHandler } from 'payload'
import type { AIPluginOptions, AIReferenceDataSource } from '../ai-types'
import { createComposerStreamGenerator } from '../composer'
import { createReferenceTools } from '../tools/referenceTools'
import { resolvePresetValues } from './custom-handler/preset'
import type { ComposerMessage } from '../composer/types'

type ComposerRequestBody = {
  firstPrompt?: string
  messages?: ComposerMessage[]
  references?: AIReferenceDataSource[]
  presetId?: string | number
  stream?: boolean
}

export const composerEndpointHandler: PayloadHandler = async (req) => {
  const pluginOptions = (req.payload.config.custom?.aiPluginOptions ?? {}) as AIPluginOptions

  if (typeof req.json !== 'function') {
    return Response.json({ error: 'Request body not available' }, { status: 400 })
  }

  const body = (await req.json()) as ComposerRequestBody

  if (!body.firstPrompt) {
    return Response.json({ error: 'firstPrompt is required' }, { status: 400 })
  }

  const { model, provider, system } = await resolvePresetValues(
    req.payload,
    body.presetId,
    req,
    ''
  )

  const requestTools = createReferenceTools({
    payload: req.payload,
    pluginOptions,
    references: body.references ?? [],
  })

  const streamComposerGeneration = createComposerStreamGenerator(pluginOptions)

  const events = streamComposerGeneration({
    firstPrompt: body.firstPrompt,
    messages: body.messages ?? [],
    references: body.references ?? [],
    model,
    provider,
    system: system || undefined,
    requestTools,
    abortSignal: 'signal' in req ? req.signal : undefined,
  })

  // NDJSON stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    },
  })
}
```

---

### Step 13 — Create `dev/app/api/ai-generate/composer/route.ts`

This is the **Next.js App Router API route** that the `useChat` hook calls. It uses `toDataStreamResponse` from the AI SDK.

> **IMPORTANT**: Before writing this file, check the exact API by looking at:
> - `node_modules/ai/docs/` — search for `toDataStreamResponse` and `streamText`
> - `node_modules/@ai-sdk/react/` — check what `useChat` expects
>
> The route needs to return a data stream compatible with `useChat`.

```ts
import { streamText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { createReferenceTools } from '../../../../src/tools/referenceTools'
import { buildComposerSystemPrompt } from '../../../../src/composer/prompt'
import type { AIPluginOptions, AIReferenceDataSource } from '../../../../src/ai-types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const payload = await getPayload({ config: configPromise })
  const pluginOptions = (payload.config.custom?.aiPluginOptions ?? {}) as AIPluginOptions

  const body = await req.json()
  const { messages = [], firstPrompt, references = [], presetId } = body

  // Resolve provider/model (simplified — can later call resolvePresetValues)
  const googleApiKey = pluginOptions.googleApiKey ?? process.env.GOOGLE_AI_API
  const google = googleApiKey ? createGoogleGenerativeAI({ apiKey: googleApiKey }) : null

  if (!google) {
    return new Response(JSON.stringify({ error: 'No AI provider configured' }), { status: 500 })
  }

  const requestTools = createReferenceTools({
    payload,
    pluginOptions,
    references: references as AIReferenceDataSource[],
  })

  const systemPrompt = buildComposerSystemPrompt()

  // Build the messages array for AI SDK useChat format
  // useChat sends messages as { role, content }[]
  // The first message should include the firstPrompt if this is the first turn
  const chatMessages = messages.length > 0
    ? messages
    : [{ role: 'user', content: firstPrompt ?? '' }]

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    messages: chatMessages,
    tools: Object.keys(requestTools).length > 0 ? requestTools : undefined,
    maxSteps: 10,
  })

  return result.toDataStreamResponse()
}
```

---

### Step 14 — Rewrite `dev/app/(frontend)/composer/ComposerClient.tsx`

Full client component using `useChat` from `@ai-sdk/react`. Layout: 3 columns (setup | live stream | plan output).

> **Before writing this file**: Check `node_modules/@ai-sdk/react/` docs for current `useChat` API — specifically:
> - What `messages` array looks like (each message has `.content`, `.role`, `.toolInvocations`)
> - How `toolInvocations` are structured
> - How to pass `body` (extra data) alongside messages
> - How `onFinish` callback works for extracting the final plan

Key `useChat` options to use:
```ts
const { messages, input, handleInputChange, handleSubmit, isLoading, stop, append } = useChat({
  api: '/api/ai-generate/composer',
  body: { firstPrompt, references, presetId },
  onFinish: (message) => {
    // Extract plan JSON from message.content and update plan state
  },
})
```

**UI structure with Tailwind v4:**

```tsx
// 3-column grid
<div className="grid grid-cols-[320px_1fr_384px] gap-4 h-screen p-4 bg-[#0f0f11] text-[#e2e2e8]">
  {/* LEFT: Setup panel */}
  <aside className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col gap-4 overflow-y-auto">
    {/* Title input */}
    {/* First prompt textarea (only shown before first send) */}
    {/* Preset picker */}
    {/* Reference collections */}
    {/* Send / Stop button */}
  </aside>

  {/* CENTER: Live stream panel */}
  <main className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col gap-3 overflow-y-auto">
    {/* Map messages — show tool calls, reasoning, text */}
    {messages.map(message => (
      // For each message: show role badge, content, tool invocations
    ))}
    {/* Follow-up input at bottom */}
    <form onSubmit={handleSubmit}>
      <input value={input} onChange={handleInputChange} />
      <button type="submit">Send</button>
    </form>
  </main>

  {/* RIGHT: Plan output panel */}
  <aside className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col gap-4 overflow-y-auto">
    {/* Plan sections: Design, Approach, Data Mapping, Components, Notes */}
    {plan ? <PlanView plan={plan} /> : <EmptyState />}
  </aside>
</div>
```

**Tool call rendering** (from `message.toolInvocations`):
```tsx
{message.toolInvocations?.map(tool => (
  <div className="bg-[#09090b] border border-[#3f3f46] rounded-lg p-3">
    <span className="text-purple-400 font-mono text-xs">{tool.toolName}</span>
    {tool.state === 'result' && <pre className="text-xs text-[#a1a1aa] mt-2">{JSON.stringify(tool.result, null, 2)}</pre>}
  </div>
))}
```

---

### Step 15 — Update `dev/app/(frontend)/layout.tsx`

```tsx
import '../../globals.css'
// ... existing imports

// Add at end of layout body (dev only):
// import AISDKDevTools from '../../components/AISDKDevTools'
// Check exact import after installing @ai-sdk/react
```

---

### Step 16 — Create `dev/components/AISDKDevTools.tsx`

> **Before writing**: Check `node_modules/@ai-sdk/react/` for the exact devtools export. It may be:
> - `import { AISDKDevTools } from 'ai/react'`
> - `import { experimental_useDevTools } from '@ai-sdk/react'`
> - A separate package `@ai-sdk/react-devtools`
>
> Search `node_modules/@ai-sdk/react/dist/` or check their README.

```tsx
'use client'

// The exact import depends on the installed version
// Check node_modules/@ai-sdk/react after install
export default function AISDKDevTools() {
  if (process.env.NODE_ENV !== 'development') return null
  // return <AISDKDevTools /> or use the hook pattern
  return null // placeholder — fill in after checking actual API
}
```

---

### Step 17 — Update `dev/app/(frontend)/composer/page.tsx`

Update to use the new `ai-composer` collection (instead of `ai-presets` only):

```tsx
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { ComposerClient } from './ComposerClient'

export const dynamic = 'force-dynamic'

export default async function ComposerPage() {
  const payload = await getPayload({ config: configPromise })

  const presetsResult = await payload.find({
    collection: 'ai-presets',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const presets = presetsResult.docs.map((p) => ({
    id: String(p.id),
    title: typeof p.title === 'string' ? p.title : String(p.id),
  }))

  const referenceCollections = Object.keys(
    ((payload.config.custom?.aiPluginOptions as Record<string, unknown>)
      ?.referenceCollections as Record<string, boolean>) ?? {}
  )

  return <ComposerClient presets={presets} referenceCollections={referenceCollections} />
}
```

---

## Critical Checks Before Starting Implementation

1. **Verify `@ai-sdk/react` export for `useChat`**: Run `grep -r "useChat" node_modules/@ai-sdk/react/dist/ | head -5` to confirm the exact import path.

2. **Verify `toDataStreamResponse`**: Run `grep -r "toDataStreamResponse" node_modules/ai/dist/ | head -5` to confirm it exists on `streamText` result.

3. **Verify AI SDK DevTools**: Run `ls node_modules/@ai-sdk/react/` after install — look for a `devtools` or similar export.

4. **Check Tailwind v4 PostCSS**: After installing, verify `node_modules/tailwindcss/index.css` exists (Tailwind v4 uses CSS-first config, no `tailwind.config.js` needed).

5. **Dev server hot reload**: Changes to `dev/` files are picked up by the running tmux dev server — no restart needed. Monitor: `tmux capture-pane -pt tx:dev`

---

## Files Not To Touch

- `src/collections/prompt.ts` — existing `ai-prompts` collection, leave it alone
- `src/endpoints/customEndpointHandler.ts` — existing stream endpoint
- `src/endpoints/previewHandler.ts` — preview endpoint
- `src/block-generation/` — HTML/CSS/JS block generation logic
- `src/components/ai-composer/` — Payload Admin field components
- Any host app files (`apps/lex`, `apps/erp`, `apps/web`)

---

## Git Workflow

All commits go to the **submodule repo** (commit from inside `packages/ai-generate/`):

```bash
cd /mnt/repo/flash-lightning/packages/ai-generate
git add .
git commit -m "feat(composer): add ai-composer collection and streaming core"
```

Then update the monorepo pointer:
```bash
cd /mnt/repo/flash-lightning
git add packages/ai-generate
git commit -m "chore: update ai-generate submodule"
```

---

## Verification Checklist

- [ ] `bun run dev` loads without errors, Tailwind classes render on composer page
- [ ] `/admin/collections/ai-composer` shows only: title, firstPrompt, preset, referenceCollections
- [ ] `curl -X POST http://localhost:4000/api/ai-generate/composer -H "Content-Type: application/json" -d '{"firstPrompt":"Build a pricing table"}'` returns NDJSON stream
- [ ] Composer page at `http://localhost:4000/composer`: enter prompt, click Send → center panel streams AI response + tool calls live
- [ ] Plan JSON appears in right panel once AI finishes
- [ ] Follow-up message sends and appends to conversation
- [ ] AI SDK DevTools panel is visible and shows token counts / tool calls
- [ ] Existing `/admin/collections/ai-prompts` still works (untouched)

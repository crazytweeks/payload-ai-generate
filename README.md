# ai-generate

`ai-generate` is a Payload plugin that adds:

- AI prompt and preset collections
- A synced registry of supported OpenAI and Google model IDs
- A `payload.ai` service for text generation and streaming
- A `/ai-generate/stream` endpoint for generating block payloads
- Portable AI prompt preview support with a built-in endpoint fallback and an optional host-app React preview page

The package keeps a local model registry in sync with the model unions shipped by `@ai-sdk/openai` and `@ai-sdk/google`. During `prebuild`, the extractor resolves those declaration files from the active runtime package resolution first, then falls back through root/package-local `node_modules` and Bun install cache layouts so Docker builds remain compatible with Bun's install strategy.

## Install

```bash
bun add ai-generate
```

## Use

```ts
import { buildConfig } from 'payload';
import { aiGenerate } from '@flash-lightning/ai-generate';

export default buildConfig({
  plugins: [
    aiGenerate({
      googleApiKey: process.env.GOOGLE_AI_API,
      openaiApiKey: process.env.OPENAI_API_KEY,
      defaultProvider: 'google',
      previewPagePath: '/preview/ai-prompts',
      defaultAdditionalData: {
        injectTailwind: true,
      },
    }),
  ],
});
```

## What it adds

The plugin registers these collection slugs:

- `aiModelsOptions`
- `ai-prompts`
- `ai-presets`

On init it also syncs the model registry collection so the database always contains the current package-supported models. Missing models are created, removed models are marked `isRemoved`, and a default model is kept per provider when possible.

Internally, the package now keeps the larger runtime areas split into dedicated modules:

- `src/ai-service/*` for provider setup, Payload integration, stream orchestration, and stream helpers
- `src/block-generation/*` for block schema, prompt building, normalization, payload shaping, and shared types
- `src/endpoints/custom-handler/*` for the composer endpoint handler flow, preset resolution, attachments, and stream responses
- `src/components/ai-composer/*` for the composer field controller, view sections, and UI utilities

## Public exports

```ts
import {
  aiGenerate,
  aiModelsOptionsCollectionSlug,
  aiPresetCollectionSlug,
  aiPromptCollectionSlug,
} from '@flash-lightning/ai-generate';
```

```ts
import { AIPromptPreviewPage } from '@flash-lightning/ai-generate/preview';
```

```ts
import { DangerousCustomRenderBlock } from '@flash-lightning/ai-generate/blocks';
import { DangerousCustomRenderBlockComponent } from '@flash-lightning/ai-generate/blocks/client';
```

```ts
import { models } from '@flash-lightning/ai-generate/models-types';
import type { GoogleModelId, OpenAIModelId } from '@flash-lightning/ai-generate/models-types';
```

```ts
import models from '@flash-lightning/ai-generate/models';
```

The `models` export is the generated runtime registry. Use it when you want to render dropdowns, inspect available models, or build your own validation on top of the package data.

## Preview integration

`ai-prompts` supports two preview modes:

- If `previewPagePath` is set, the plugin generates a normal `/next/preview?...` URL that redirects into your app's React page.
- If `previewPagePath` is not set, the plugin falls back to its built-in `/api/ai-generate/preview?...` endpoint.

Host app page example:

```tsx
import { AIPromptPreviewPage } from '@flash-lightning/ai-generate/preview';
import { getClientSideURL } from '@/utilities/getURL';

export default async function ERPAppAIPromptPreviewPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <AIPromptPreviewPage
      {...props}
      serverURL={getClientSideURL()}
      defaultAdditionalData={{
        injectTailwind: true,
      }}
    />
  );
}
```

`defaultAdditionalData` lets host apps inject shared preview defaults before and after the generated asset content:

```ts
aiGenerate({
  previewPagePath: '/preview/ai-prompts',
  defaultAdditionalData: {
    injectTailwind: true,
    beforeCSS: '.preview-shell { padding: 24px; }',
    beforeJS: 'const user = { name: "Preview User" };',
    afterJS: 'console.log("preview ready")',
  },
});
```

Available fields:

- `beforeCSS`
- `afterCSS`
- `beforeJS`
- `afterJS`
- `injectTailwind`

## Block integration

The package also exports a reusable relationship-based dangerous custom render block. Instead of copying generated HTML, CSS, and JS into each page block instance, the block stores a single relationship to an `ai-prompts` document and renders from that prompt's generated fields.

Collection config example:

```ts
import { DangerousCustomRenderBlock } from '@flash-lightning/ai-generate/blocks';

{
  name: 'layout',
  type: 'blocks',
  blocks: [DangerousCustomRenderBlock],
}
```

Renderer registration example:

```tsx
import { DangerousCustomRenderBlockComponent } from '@flash-lightning/ai-generate/blocks/client';

const blockComponents = {
  'dangerous-custom-render': DangerousCustomRenderBlockComponent,
};
```

If you want to keep local file paths stable in an app, you can also thinly re-export the shared package files from your app-local block folder.

## Example

```ts
import { models } from '@flash-lightning/ai-generate/models-types';

const googleModels = models.google;
const openaiModels = models.openai;
```

```ts
import type { GoogleModelId } from '@flash-lightning/ai-generate/models-types';

const model: GoogleModelId = 'gemini-2.5-flash';
```

## Notes

- `aiGenerate()` augments the incoming Payload config instead of replacing it.
- The model registry collection is intended to be synced automatically, not edited by hand.
- Models marked `isDeprecated` or `isRemoved` should remain visible for compatibility, but they should not be the active default.
- The package-level barrels in `src/aiService.ts`, `src/block-generation.ts`, and `src/endpoints/customEndpointHandler.ts` stay as stable entrypoints while the implementation is split underneath them.
- The `ai-generate/preview` export is intended for server components and Next.js app routes that want to reuse the package preview UI.
- The `ai-generate/blocks` exports are intended for host apps that want to reuse the package's AI prompt-backed render block instead of maintaining a duplicate local implementation.

## Project Tracking

- Ongoing package work and pending tasks are tracked in [`TASKS.md`](./TASKS.md).
- Release notes for this plugin are tracked in [`CHANGELOG.md`](./CHANGELOG.md).
- Set `referenceMediaCollectionSlug` in plugin options if you want `ai-prompts` to accept uploaded image and document references for AI generation.
- When tools or multimodal references are enabled, the plugin may automatically use compatibility-mode JSON streaming instead of provider-enforced structured output to keep a wider range of models usable.
- OpenAI block-generation requests use compatibility-mode streaming by default because the Responses API can reject some structured schemas even when the generated output itself is valid for the package.
- On the OpenAI composer path, uploaded references are inlined as bytes and project tools are disabled to prioritize reliable multimodal generation.

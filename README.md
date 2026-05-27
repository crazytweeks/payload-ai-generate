# payload-ai-generate

> **⚠️ Early Beta — Under Active Development**
> This plugin is in early beta (`0.1.4-beta.1`). APIs, collection slugs, and block types may change between releases without a deprecation period. Do not use in production environments without thoroughly reviewing each update. Breaking changes will be noted in [CHANGELOG.md](./CHANGELOG.md).

`payload-ai-generate` is a Payload CMS plugin that adds:

- AI prompt and preset collections
- AI composer planning sessions and persisted multi-file UI outputs
- A synced registry of supported OpenAI and Google model IDs
- A `payload.ai` service for text generation and streaming
- A `/api/ai-generate/stream` endpoint for generating block payloads
- A `/api/ai-generate/composer` endpoint for planning UI generation sessions
- A built-in `ai-html-block` for rendering AI-generated HTML/CSS/JS content in a sandboxed iframe
- Portable AI prompt preview support with a built-in endpoint fallback and an optional host-app React preview page

## Install

```bash
npm install payload-ai-generate
# or
bun add payload-ai-generate
```

## Use

```ts
import { buildConfig } from 'payload';
import { aiGenerate } from 'payload-ai-generate';

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
- `ai-composer`
- `ai-composer-ui`

On init it syncs the model registry collection so the database always contains the current package-supported models. Missing models are created, removed models are marked `isRemoved`, and a default model is kept per provider when possible.

Internally, the package keeps runtime areas split into dedicated modules:

- `src/ai-service/*` — provider setup, Payload integration, stream orchestration, and stream helpers
- `src/block-generation/*` — block schema, prompt building, normalization, payload shaping, and shared types
- `src/endpoints/custom-handler/*` — composer endpoint handler flow, preset resolution, attachments, and stream responses
- `src/components/ai-composer/*` — composer field controller, view sections, and UI utilities

## Public exports

```ts
import {
  aiGenerate,
  aiModelsOptionsCollectionSlug,
  aiPresetCollectionSlug,
  aiPromptCollectionSlug,
} from 'payload-ai-generate';

```

```ts
import { ComposerClient, ComposerV2Client } from 'payload-ai-generate';
```

```ts
import { AIPromptPreviewPage } from 'payload-ai-generate/preview';
```

```ts
import { AiHtmlBlock } from 'payload-ai-generate/blocks';
import { AiHtmlBlockComponent } from 'payload-ai-generate/blocks/client';
```

```ts
import { models } from 'payload-ai-generate/models-types';
import type { GoogleModelId, OpenAIModelId } from 'payload-ai-generate/models-types';
```

```ts
import models from 'payload-ai-generate/models';
```

The `models` export is the generated runtime registry. Use it when you want to render dropdowns, inspect available models, or build your own validation on top of the package data.

## Preview integration

`ai-prompts` supports two preview modes:

- If `previewPagePath` is set, the plugin generates a normal `/next/preview?...` URL that redirects into your app's React page.
- If `previewPagePath` is not set, the plugin falls back to its built-in `/api/ai-generate/preview?...` endpoint.

Host app page example:

```tsx
import { AIPromptPreviewPage } from 'payload-ai-generate/preview';

export default async function AIPromptPreviewRoute(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <AIPromptPreviewPage
      {...props}
      serverURL={process.env.NEXT_PUBLIC_SERVER_URL ?? ''}
      defaultAdditionalData={{
        injectTailwind: true,
      }}
    />
  );
}
```

`defaultAdditionalData` lets host apps inject shared preview defaults:

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

Available fields: `beforeCSS`, `afterCSS`, `beforeJS`, `afterJS`, `injectTailwind`.

## Block integration

The package exports a reusable `ai-html-block` that stores a relationship to an `ai-prompts` document and renders from that prompt's generated fields. The block renderer isolates all AI-generated HTML, CSS, and JS inside a **sandboxed iframe** (`sandbox="allow-scripts"`) so the generated code cannot access the parent page's DOM, cookies, or storage.

Collection config:

```ts
import { AiHtmlBlock } from 'payload-ai-generate/blocks';

{
  name: 'layout',
  type: 'blocks',
  blocks: [AiHtmlBlock],
}
```

Renderer registration:

```tsx
import { AiHtmlBlockComponent } from 'payload-ai-generate/blocks/client';

const blockComponents = {
  'ai-html-block': AiHtmlBlockComponent,
};
```

## Model types example

```ts
import type { GoogleModelId } from 'payload-ai-generate/models-types';

const model: GoogleModelId = 'gemini-2.5-flash';
```

## Notes

- `aiGenerate()` augments the incoming Payload config instead of replacing it.
- The model registry collection is synced automatically on `onInit` — do not edit it by hand.
- Models marked `isDeprecated` or `isRemoved` remain visible for compatibility but should not be set as the active default.
- The `ai-generate/preview` export is intended for Next.js server components and app routes.
- Set `referenceMediaCollectionSlug` in plugin options to allow `ai-prompts` to accept uploaded image and document references for AI generation.
- When tools or multimodal references are enabled, the plugin may use compatibility-mode JSON streaming to keep a wider range of models usable.
- OpenAI block-generation requests use compatibility-mode streaming by default because the Responses API can reject some structured schemas even when the output is valid.

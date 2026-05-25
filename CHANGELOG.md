# CHANGELOG

## 1.1.4

- Added the requested code ID context to dangerous custom render block fetch diagnostics so missing prompt lookups are easier to trace.

## 1.1.3

- Fixed model declaration discovery during Bun/Docker builds by resolving AI SDK package declarations from runtime resolution, package-local `node_modules`, root `node_modules`, and Bun install cache layouts.
- Kept the model artifact extractor compatible with deployment environments that do not place `@ai-sdk/google` and `@ai-sdk/openai` exactly under the repository root `node_modules`.

## 1.1.2

- Added reusable `ai-generate/blocks` and `ai-generate/blocks/client` exports for the relationship-based dangerous custom render block config and renderer.
- Switched the shared dangerous custom render block to a single `code` relationship field that points at `ai-prompts`, so renderable HTML/CSS/JS stays canonical in the AI prompt document instead of being duplicated in page block data.
- Updated the local dev Payload config fixture to exercise the exported block and regenerated its payload types for the new relationship-based shape.

## 1.1.1

- Added portable AI prompt preview support with a built-in `/ai-generate/preview` fallback endpoint for apps that do not provide a custom preview page.
- Added `previewPagePath` and `defaultAdditionalData` plugin options so host apps can opt into a Next.js preview page and inject shared CSS/JS defaults into the preview renderer.
- Exported `AIPromptPreviewPage` through `ai-generate/preview` so host apps can mount a reusable React preview route instead of copying the package dev page.
- Updated package exports to resolve from built `dist` artifacts, keeping the published package surface aligned with the compiled output.

## 1.1.0

- Split the composer UI into dedicated `ai-composer` view, controller, and utility modules while keeping the Payload field entrypoint thin.
- Split block-generation logic into dedicated schema, prompt, normalization, payload, and type modules.
- Split the AI service runtime into dedicated option resolution, Payload integration, block streaming, stream utility, and provider-runner modules.
- Split the `/ai-generate/stream` endpoint into dedicated handler, preset, attachment, stream-response, and endpoint-type modules.
- Updated package dependencies to the current Payload `3.82.1` and AI SDK patch releases used by the refactored internals.

## 1.0.3

- Disabled project tool-calling on the OpenAI composer path to avoid no-output runs in compatibility mode.
- Inlined uploaded reference files as bytes for multimodal requests so local/dev media assets do not rely on provider-side URL fetching.

## 1.0.2

- Fixed OpenAI structured-output schema incompatibility for `variables` in block generation.
- Added compatibility-mode fallback for model requests that should stream JSON text instead of relying on provider schema enforcement.
- Forced OpenAI block generation requests to use compatibility-mode streaming by default.
- Added streamed reference events and visible selected-reference chips in the AI composer UI.

## 1.0.1

- Added streaming generation repair attempts with classified outcomes.
- Added persisted AI prompt history and last-run metadata for follow-up edits.
- Added follow-up and manual retry-fix actions in the admin composer UI.
- Added package task tracking via `TASKS.md`.
- Added optional upload-backed reference attachments for AI prompt generation and follow-up requests.

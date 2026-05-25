# CHANGELOG

## 0.1.1-beta.1 — 2026-05-25

- Added configurable reference collections for AI prompts, including repeatable collection, limit, loading mode, and filter JSON controls.
- Added server-side reference data fetching for `ai-html-block` rendering and exposed resolved prompt data in the dev post page.
- Added dev-only `test-messages`, `test-products`, and `test-announcements` collections with seed data.
- Updated dev generation scripts and Payload types to include dev reference collections.
- Fixed reference collection select validation when duplicate filtering is enabled.

---

## 0.1.0-beta.1 — 2026-05-25

First public beta release of `payload-ai-generate`.

- Renamed `dangerous-custom-render` block to `ai-html-block` across all exports, slugs, and type names.
- Replaced inline script DOM injection in the block renderer with a **sandboxed iframe** (`sandbox="allow-scripts"`), fully isolating AI-generated JS from the host page's DOM, cookies, and storage.
- Fixed a bug in the server block component where the prompt document was being fetched from the wrong collection (`ai-presets` instead of `ai-prompts`).
- Set version to `0.1.0-beta.1` and marked the package as public for npm publishing.
- Updated `tsconfig.json` to be self-contained (no longer extends a monorepo base config).
- Renamed all public TypeScript exports from `DangerousCustomRender*` to `AiHtml*`.

---

## 0.0.6-alpha — internal

- Added `blockPayloadJSON` code field to the `ai-prompts` collection for a ready-to-paste block payload.
- Added request-scoped code ID to diagnostic logging in the block render component to make missing prompt lookups easier to trace.

## 0.0.5-alpha — internal

- Fixed model declaration discovery during Bun/Docker builds by resolving AI SDK package declarations from runtime resolution, package-local `node_modules`, root `node_modules`, and Bun install cache layouts.

## 0.0.4-alpha — internal

- Added `ai-generate/blocks` and `ai-generate/blocks/client` exports for the relationship-based block config and renderer.
- Switched the block to a single `code` relationship field pointing at `ai-prompts` so generated HTML/CSS/JS stays canonical in the prompt document instead of being duplicated in page block data.
- Updated the dev Payload config to exercise the exported block.

## 0.0.3-alpha — internal

- Added portable AI prompt preview support with a built-in `/api/ai-generate/preview` fallback endpoint.
- Added `previewPagePath` and `defaultAdditionalData` plugin options so host apps can opt into a custom Next.js preview page and inject shared CSS/JS defaults into the preview renderer.
- Exported `AIPromptPreviewPage` through `ai-generate/preview` for reuse in host app routes.

## 0.0.2-alpha — internal

- Split the composer UI into dedicated `ai-composer` view, controller, and utility modules.
- Split block-generation logic into schema, prompt, normalization, payload, and type modules.
- Split the AI service runtime into option resolution, Payload integration, block streaming, stream utility, and provider-runner modules.
- Split the `/api/ai-generate/stream` endpoint into handler, preset, attachment, stream-response, and endpoint-type modules.

## 0.0.1-alpha — internal

- Initial plugin scaffolding using `npx create-payload-app@latest --template plugin`.
- Added `ai-prompts`, `ai-presets`, and `aiModelsOptions` collections.
- Added `payload.ai` service for text generation and streaming via OpenAI and Google providers (Vercel AI SDK).
- Added streaming generation with repair attempts and classified outcomes.
- Added persisted AI prompt history and last-run metadata for follow-up edits.
- Added follow-up and retry-fix actions in the admin composer UI.
- Added optional upload-backed reference attachments for AI prompt generation and follow-up requests.
- Added OpenAI compatibility-mode streaming fallback.

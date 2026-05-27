# CHANGELOG

## 0.1.5-beta.1 — 2026-05-27

- Migrated `ComposerV2Client` and API routes (`uiGenerateEndpointHandler.ts`, `composerEndpointHandler.ts`) into the plugin core.
- Added file/media upload support to Composer V2, linked to the `ai-media` collection.
- Added generation-phase follow-up message support (refinements) to Composer V2.
- Exported `ComposerV2Client` and `ComposerClient` from the plugin index for external reuse.
- Replaced custom REST session APIs with standard Payload local API integrations.

---

## 0.1.4-beta.1 — 2026-05-27

- Added **Composer v2 sessions sidebar**: collapsible panel listing all saved `ai-composer` sessions with timestamps; clicking a session restores its prompt, plan, messages, references, and preset without re-triggering AI calls; new-session button resets state.
- Added `GET /api/ai-generate/composer-session` endpoint (list recent sessions) and `GET /api/ai-generate/composer-session/[id]` endpoint (fetch single session).
- Added `@plugin/*` TypeScript path alias in `dev/tsconfig.json` pointing to `../src/`; replaced all deep relative `../../../../../../src/` imports across 14 dev files.
- Fixed `dev` script in `package.json` to run `devserver` and `devtool` in parallel via `concurrently`.

---

## 0.1.3-beta.1 — 2026-05-26

- Added Composer v2 session persistence: plans and chat messages are saved to `ai-composer`.
- Linked generated `ai-composer-ui` documents back to their Composer planning session.
- Fixed Composer reference row storage to use the same `collection` field expected by generation tools.
- Updated AI SDK v6 tool-part handling to support `tool-*` parts and `output-available` tool state.
- Scoped Vitest to package unit tests so dev integration/e2e specs do not run under the wrong test runner.
- Added the missing `@ai-sdk/react` package dependency used by the dev Composer UI.

---

## 0.1.2-beta.1 — 2026-05-26

- Added **AI Composer** plan-mode feature: new `ai-composer` Payload collection, `src/composer/` streaming module, and `POST /api/ai-generate/composer` endpoint for plan generation.
- Added 3-column composer UI (`ComposerClient.tsx`) with live streaming, tool-call visibility, reasoning display, and plan output panel with Proceed/Refine actions.
- Switched default AI provider to **OpenAI `gpt-5.5`** across all composer routes; Google Gemini (`gemini-2.5-flash`) retained as fallback.
- Installed Tailwind v4 on the dev app (`@tailwindcss/postcss`, `globals.css` with CSS-first config).
- Upgraded all AI SDK v6 call sites: `stopWhen: stepCountIs(N)` replacing `maxSteps`, `await convertToModelMessages()`, `toUIMessageStreamResponse()`, correct `chunk.text` / `chunk.input` field names.
- Fixed crash in `PlanView` when AI response omits the `components` array.

---

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

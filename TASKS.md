# payload-ai-generate — Tasks & Roadmap

This file is the source of truth for planned work, feature ideas, known issues, and quality gates.
**Agents**: read this before starting any work, and update the relevant section before every commit/push.

---

## Status Legend

- `[ ]` — not started
- `[~]` — in progress
- `[x]` — done
- `[!]` — blocked / needs decision

---

## Active / In Progress

- [~] Add reference data fetch tools to block generation — 🤖 agent-codex-ref-data (2026-05-25T18:53Z)

---

## Bugs

- [x] `PreviewFrame.tsx` — `SyntaxError: missing ) after argument list` when AI-generated JS/data contains `</script>` — fixed by escaping `<\/script` before innerHTML injection
- [x] `blocks/ai-html-block/Component.tsx` — wrong collection slug (`aiPresetCollectionSlug`) and wrong return value (`.data`) — fixed to use `aiPromptCollectionSlug` and return full doc

---

## Features & Improvements

### Core Generation
- [ ] Streaming support for block generation (currently awaits full response)
- [ ] Retry / error-recovery UI when generation fails mid-stream
- [ ] Token usage tracking and surfacing in the admin UI
- [ ] Support for image inputs (vision models) in prompt context

### Block: `ai-html-block`
- [ ] Live variable substitution preview (update iframe on variable change without re-generating)
- [ ] Export generated HTML/CSS/JS to file or copy-to-clipboard button in admin
- [ ] Configurable iframe height (currently auto, min 100px)
- [ ] Allow host app to inject global CSS/JS into the iframe sandbox (theming, design tokens)

### Preview (`PreviewFrame`)
- [ ] Migrate `PreviewFrame` from direct DOM script injection to sandboxed iframe (same pattern as `ClientComponent`) for consistent security model
- [ ] Support `injectTailwind` v3/v4 toggle (currently hardcoded to Tailwind v2 CDN)

### Plugin Config
- [ ] `apiKeyResolver` callback option — let host apps provide API keys dynamically (per-tenant, per-user) instead of env vars only
- [ ] Per-collection model override (set default model at collection level, not just global)
- [ ] Rate limiting / request throttling option for multi-tenant setups

### Admin UI
- [ ] "Regenerate" button on existing prompt documents
- [ ] Generation history — keep last N versions of generated output per document
- [ ] Model selector visible in prompt creation form (with cost/speed hints)
- [ ] Prompt template library — reusable system prompt snippets

### Developer Experience
- [ ] Full TypeScript types export for all public block shapes
- [ ] `payload-ai-generate/server` export for server-only utilities (no client bundle bloat)
- [ ] Storybook or similar for block component development/visual testing

---

## Security Checklist

- [x] AI-generated JS runs in sandboxed iframe (`sandbox="allow-scripts"`) in `ClientComponent`
- [x] `</script>` and `</style>` escaped before injection in `ClientComponent` and `PreviewFrame`
- [ ] Validate/sanitize `dataJSON` input before passing to iframe (guard against prototype pollution)
- [ ] CSP header recommendation documented for host apps using this plugin
- [ ] Preview endpoint (`PREVIEW_SECRET`) — verify secret is checked on every request, add test
- [ ] Audit all `any` casts and unsafe type assertions in `src/`

---

## Tests Needed

- [ ] Unit: `escapeClosingTag` helper — edge cases (`</SCRIPT>`, nested, empty string)
- [ ] Unit: `applyVariables` — missing key, regex special chars in key name, empty variables
- [ ] Unit: block generation schemas (`generatedAiHtmlSchema`) — valid/invalid AI output shapes
- [ ] Unit: `normalize.ts` — partial block normalization edge cases
- [ ] Integration: `ai-html-block` Component server-side fetch (mock Payload `findByID`)
- [ ] Integration: preview endpoint auth (valid secret, missing secret, wrong secret)
- [ ] E2E: full prompt creation → generation → preview render flow (Playwright, dev server)

---

## Documentation

- [ ] JSDoc on all public exported functions and types
- [ ] Add `CONTRIBUTING.md` with dev setup steps and submodule workflow note
- [ ] Document `defaultAdditionalData` prop with real examples in README
- [ ] Document how to wire `AiHtmlBlock` into a host app's RenderBlocks component
- [ ] Add screenshots/GIF of the admin UI to README

---

## Before First Stable Release (1.0.0)

- [ ] All security checklist items done
- [ ] Core test suite passing (unit + integration)
- [ ] README complete with install, config, and usage examples
- [ ] CHANGELOG up to date
- [ ] `private: false` confirmed, `publishConfig` set correctly
- [ ] Dry-run `npm publish --dry-run` passes without errors
- [ ] Peer dependency range reviewed (`payload ^3.x`)

---

## Ideas / Backlog (not committed)

- Anthropic Claude model support via `@ai-sdk/anthropic`
- Automatic alt-text generation for media uploads
- "AI polish" button on Lexical rich-text fields
- Multi-modal block: generate image + layout together
- Webhook trigger: regenerate on document publish

---

## Completed

- [x] Add usage checkbox to AI prompt reference rows
- [x] Fix reference collection select validation with duplicate filtering
- [x] Show server-resolved AI prompt reference data JSON on dev render page
- [x] Server-side reference data fetching with third dev test collection
- [x] Multiple reference collection configs and second dev test collection
- [x] Add posts frontend pages to dev app — list page, detail page with AiHtmlBlock rendering, preview & live preview wired up
- [x] Dev-only reference test collections and seed data for reference collection config
- [x] Extracted plugin from flash-lightning monorepo to standalone repo (`crazytweeks/payload-ai-generate`)
- [x] Added as git submodule at `packages/ai-generate` in flash-lightning
- [x] Renamed `dangerous-custom-render` block → `ai-html-block` everywhere
- [x] Security: replaced `dangerouslySetInnerHTML` + direct DOM injection with sandboxed iframe in `ClientComponent`
- [x] Fixed `</script>` injection vulnerability in `PreviewFrame`
- [x] Package renamed `@flash-lightning/ai-generate` → `payload-ai-generate`
- [x] Version set to `0.1.0-beta.1`
- [x] README rewritten with beta warning and correct import paths
- [x] CHANGELOG rewritten as clean plugin history (alpha → beta)
- [x] All flash-lightning apps updated to import from `payload-ai-generate`
- [x] Build verified passing for `lex`, `erp`, `web` after rename
- [x] `.env.example` added to plugin root

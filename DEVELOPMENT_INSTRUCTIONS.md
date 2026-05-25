# Development Instructions — payload-ai-generate

Rules and conventions for agents and developers working on this plugin.
**Read this file before touching anything.** Update it when you discover something worth recording.

---

## 1. Dev Server — Do Not Disturb

A live dev server runs on **tmux session `tx dev`** at **http://localhost:4000**.

- **Never** kill, restart, or modify the tmux session or the Next.js process inside it.
- **Never** run `bun dev`, `next dev`, or any command that starts a server on port 4000.
- **Never** delete or overwrite `dev/.env` (the running server's active env file — not committed).
- Hot reload is active — file saves are picked up automatically. You do not need to restart anything after editing `src/` files.
- If you need to verify a runtime change, check the tmux session output passively: `tmux capture-pane -pt tx:dev` (read-only).

---

## 2. Parallel Agent Coordination via TASKS.md

Multiple agents may be working on this plugin simultaneously. To avoid conflicts:

1. **Before starting any task**, open [TASKS.md](./TASKS.md) and find the item you are about to work on.
2. **Claim it** by appending your agent identifier and a timestamp:
   ```
   [~] The task description — 🤖 agent-claude-abc123 (2026-05-25T16:00Z)
   ```
3. **Commit the claim** to the submodule repo immediately (before writing any code), with message `chore(tasks): claim "<task name>"`.
4. **Do not start** a task that already has another agent's identifier on it. Check git log to see if the claim commit is recent (within the last 2 hours). If stale, you may take over — update the identifier and re-commit.
5. **On completion**, move the item to the `## Completed` section, remove the agent tag, and commit with `chore(tasks): complete "<task name>"`.

---

## 3. Repository & Submodule Structure

This plugin (`packages/ai-generate`) is a **git submodule** inside the `flash-lightning` monorepo.

- The plugin has its own git history at `https://github.com/crazytweeks/payload-ai-generate`.
- **All plugin commits go to the submodule repo** (`git commit` from inside `packages/ai-generate/`), not to flash-lightning directly.
- After pushing plugin commits, update the submodule pointer in flash-lightning: `cd ../.. && git add packages/ai-generate && git commit -m "chore: update ai-generate submodule"`.
- The plugin's `main` branch is the publishing branch. Feature work can use short-lived branches but must be merged to `main` before the pointer in flash-lightning is updated.

---

## 4. Package Name & Imports

The npm package name is **`payload-ai-generate`** (not `@flash-lightning/ai-generate` — that is the old name, do not use it).

- All imports inside the plugin use relative paths.
- Host app imports use `payload-ai-generate`, `payload-ai-generate/client`, `payload-ai-generate/blocks`, etc.
- The Payload admin component path hardcoded in `src/collections/prompt.ts` must stay `payload-ai-generate/client` — this string is written into the generated `importMap.js` of host apps.

---

## 5. Security Rules

- AI-generated content (HTML/CSS/JS) **must** be rendered inside a sandboxed iframe (`sandbox="allow-scripts"`). Never render it directly into the host page DOM.
- Any string injected into a `<script>` or `<style>` tag via `innerHTML` or `srcDoc` **must** have `</script>` / `</style>` escaped first. Use the `escapeClosingTag` helper in `src/blocks/ai-html-block/ClientComponent.tsx`.
- Do not introduce new `dangerouslySetInnerHTML` usages outside the existing, documented ones in `PreviewFrame.tsx`. Add a `biome-ignore` comment with justification if you must.
- Never log or expose API keys. Resolve them server-side only.

---

## 6. Code Style & Conventions

- **No comments** unless the WHY is non-obvious (a hidden constraint, a workaround, a subtle invariant). Do not describe what the code does.
- **No unused variables** — TypeScript strict mode and Biome lint will fail the build.
- Exported types live next to their implementation, not in a central `types.ts` unless shared across multiple files.
- Block slugs are kebab-case strings (e.g. `ai-html-block`). Interface names are PascalCase (e.g. `AiHtmlBlockType`). Keep them in sync across `config.ts`, `types.ts`, `ai-types.ts`, and the generation schemas.
- When renaming anything public (block slug, export name, collection slug), grep the entire monorepo — host apps (`apps/lex`, `apps/erp`, `apps/web`) import from this package and hardcode slugs in `RenderBlocks.tsx` and `importMap.js`.

---

## 7. Testing

- Run tests from inside the plugin directory: `bun test` (uses Vitest).
- Do not run tests in a way that hits the live dev database. Use the test database configured in `dev/.env.example`.
- Before pushing, verify TypeScript compiles: `bun run build:types` (or check that the dev server has no TS errors in the tmux output).

---

## 8. Versioning & Publishing

- Current version: `0.1.0-beta.1` — this is a **beta**. Do not publish a stable `1.0.0` until all items in the "Before First Stable Release" section of TASKS.md are done.
- Bump version in `package.json`, add a CHANGELOG entry, then tag: `git tag v0.x.x-beta.y`.
- Publish: `npm publish --access public` (dry run first: `npm publish --dry-run`).
- Do not publish from inside the monorepo `node_modules` context — publish from the submodule root directly.

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Design rules

- This is a tool, not a landing page: the first screen is the working surface (the item list and the Start action). No marketing hero or explanatory paragraphs above it.
- One source of truth per screen: never show the same data twice in two editable forms (e.g. raw text and a parsed list) where edits in one rewrite the other behind the user's back.
- Every interactive element must look interactive; one primary action per screen, placed next to what it acts on.
- Media plays inside the element that represents the item (card, thumbnail, tile), never in a separate floating or appended player box.
- Before claiming a UI is done, walk the core tasks in a real browser at desktop and mobile widths (add, edit, remove, reorder items; attach and play songs; start, finish, share) and score it against the ux-heuristics quick diagnostic.
- YouTube playback uses the IFrame API with `controls=0` behind our own controls (progress strip, pause/resume, stop). Cover art stays over the video for the first 3 seconds (YouTube's start-up overlays) and permanently for "- Topic" art tracks.
- UI motion is CSS only and must respect `prefers-reduced-motion`. Remotion is used only for the results recap (`src/recap/`, a 9:16 tap-through story with per-slide songs) and stays lazy-loaded.
- "Copy list" output must paste straight back into a new sort: `## Title`, `**N.** [Label](<link>)` (bold rank so ties render, `<...>` so Discord does not embed), escaped Markdown in labels.

## Working rules

- The dev server (`bun run dev --port 5199`) stays running between turns. Never stop it while the work is under review; stop only servers started for one-off checks (e.g. a static preview of `dist/`).
- Unit tests live next to the code (`src/lib/*.test.ts`, Vitest). Run `bun run test` (capped at 2 workers in `vitest.config.ts`); the Pages workflow runs type-check and tests before building, so a failing test blocks deploys.
- Integration tests are Playwright (`e2e/app.spec.ts`, one worker, mock keychain, muted) against the production build on port 4173: `bun run test:e2e`. They run in the Pages workflow after the unit tests. Wait for the sorter (`.faceoff`) before sending keys.
- Always pass absolute paths to `agent-browser screenshot`; relative paths land in the repo root. Root-level `*.png` files are gitignored, and `git status` must be checked before every commit because this repo is public.

# AGENTS GUIDE

Repository: read-or-switch — Next.js 15 (App Router, React Compiler) / React 19 / TypeScript 5 / Tailwind 4 / MySQL
Purpose: Narrative Text Foraging study app (Parts A/B/C + cognitive tasks).
Audience: coding agents; follow before modifying code. Target length ~150 lines; keep updated.

## 1) Commands
- Dev: `npm run dev`
- Build (type+bundle+tsc): `npm run build`
- Start built app: `npm run start`
- Lint: `npm run lint`
- Rename existing A/C data safely: `npm run db:migrate:part-names` (stop the app first; no reseeding).
- Production upgrade only: `npm run db:migrate:production` uses process env (`MYSQL_URL` or `DB_*`), renames legacy A/C tables, adds timing/recall fields, and repairs the original placeholder question options without resetting data. Railway runs the packaged version before deploy.
- DB migrate: `npx tsx src/db/migrate.ts`
- Seed (after dev server running):
  - Part A: `http://localhost:3000/api/seed-part-a-new`
  - Part B: `http://localhost:3000/api/seed-part-b-new`
  - Part C: `http://localhost:3000/api/seed-part-c`
- Env: `.env.local` with `DB_HOST, DB_USER, DB_PASSWORD, DB_NAME`
- Package manager: npm (package-lock present). Prefer npm for installs.

## 2) Tests
- Node built-in tests (Node 22.6+): `npm test`.
- Active reading timer: `npm run test:one -- tests/active-reading-timer.test.mjs`.
- Single file: `npm run test:one -- tests/part-c-timing.test.mjs`.
- Existing databases: `npm run db:migrate:part-c-timing` adds timing columns without resetting tables.
- Part A practice/formal recalls: `npm run db:migrate:part-a-recall-phases` adds the phase column without resetting data.
- Part C recall storage: `npm run db:migrate:part-c-recall` creates the summary table without resetting data.
- Participant details: `npm run db:migrate:participant-details` adds the name field and removes the placeholder email default, preserving existing records. Entry requires ID, name, email, and consent.
- Registration validation: `npm run test:one -- tests/participant-registration.test.mjs`.
- Also validate changes via lint + build and focused manual checks of routes/components.

## 3) Linting & formatting
- ESLint flat config: `eslint.config.mjs` using `eslint-config-next` core-web-vitals + TypeScript, adapted with `FlatCompat` from `@eslint/eslintrc` for ESLint 9.
- Ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts` via `globalIgnores` override.
- No Prettier/Stylelint. Follow local file style: 4-space indentation, semicolons; prefer double quotes in TS/TSX but keep consistency within the file.
- Run `npm run lint` before handoff; fix violations rather than disabling rules.

## 4) Stack & runtime
- Next.js App Router in `src/app`; React Compiler enabled (`reactCompiler: true` in `next.config.ts`).
- React 19; default to Server Components. Add "use client" only when state/effects/handlers are needed and keep client components lean.
- Path alias: `@/*` -> `./src/*` (see `tsconfig.json`).
- Tailwind v4 via `@import "tailwindcss"` in `src/app/globals.css`; theme uses CSS vars and `@theme inline` tokens.
- Fonts: Geist Sans/Mono from `next/font/google` in `src/app/layout.tsx`.

## 5) Data layer & environment
- MySQL via `mysql2/promise`; shared pool in `src/lib/db.ts` (connectionLimit 10).
- Use `query(sql, params)` helper; always parameterize inputs. Never interpolate user data into SQL strings.
- For typed results, use `RowDataPacket` (mysql2) and narrow to typed arrays/records.
- Use `pool.getConnection()` for transactions and release in `finally`.
- `.env.local` required for DB creds; never commit secrets. Migration script reads it manually.
- Migrations/seeds consume CSVs under `docs/Study Material/*`; scripts are TypeScript run with tsx.
- When schema changes, update `src/db/migrate.ts` and CSV-driven seeders together; keep FK toggles consistent.

## 6) API routes (Next.js route handlers)
- Location: `src/app/api/**/route.ts`; export `GET`/`POST` handlers only.
- For routes using `request.url`/`searchParams`, add `export const dynamic = "force-dynamic"` (used in stories/subtopics routes).
- Respond with `NextResponse.json(payload, { status })` everywhere.
- Validate required params early; return 400 on missing/invalid, 404 on not found.
- Wrap DB calls in try/catch; log with `console.error("Failed to <action>:", error)` plus context.
- If selecting table names dynamically, only choose from a small whitelist derived from validated inputs.
- Keep handlers small; move reusable logic to `src/lib`.
- Never suppress types (`as any`, `@ts-ignore`, `@ts-expect-error`). Narrow shapes and use typed arrays/records instead.

## 7) Frontend components
- Components live in `src/app/**/components`; server by default.
- Add "use client" only when hooks/events are used; keep client components small.
- Type props explicitly; reuse shapes from `src/app/part-b/types.ts` and `src/app/part-a/types.ts`.
- Avoid inline `any`; type API responses and local state.
- Styling via Tailwind utilities and theme vars in `globals.css`; keep palette and spacing consistent.
- React Compiler constraints: stable hook order; avoid recreating functions/objects in render; prefer memo-friendly patterns.

## 8) Imports
- Order: Node built-ins -> external packages -> internal `@/...` paths.
- Use `node:` prefix for built-ins in config/server files when editing them.
- Use `import type { ... }` when it trims runtime impact.
- Automatic JSX runtime means no default React import.

## 9) Types & strictness
- `tsconfig.json`: `strict: true`, `noEmit: true`, `moduleResolution: bundler`, JSX `preserve`, target ES2017.
- Provide explicit return types for exported functions; allow inference for simple locals.
- Narrow DB results to typed shapes; avoid widening to `any`.
- Do not add `@ts-ignore` / `@ts-expect-error` without explicit approval.

## 10) Error handling & logging
- Fail fast on invalid input with concise 400 JSON messages.
- Expected absence => 404 JSON.
- Unexpected errors: log with context string; return 500 JSON without leaking stack traces or secrets.
- Avoid empty catches; include context and rethrow or return error response.

## 11) Naming conventions
- Components: PascalCase; files match component when possible.
- Types/interfaces: PascalCase (e.g., `Story`, `Segment`, `Question`).
- Variables/functions: camelCase; constants UPPER_SNAKE when appropriate.
- API folder names descriptive (`submit`, `questions`, `segments`); handlers are `GET`/`POST` exports only.
- Env vars: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

## 12) Styles & UX
- Palette and utilities defined in `src/app/globals.css` (`--background`, `--foreground`, `--primary`, `--muted`, etc.).
- Reuse utilities: `.glass-panel`, `.focus-ring`, `.custom-scrollbar`; maintain light theme defaults.
- Maintain focus visibility and keyboard operability; ensure accessible labels and hit targets.
- For UX-heavy work, also consult `GEMINI.md` (Nielsen heuristics, 100–200ms feedback, deliberate motion, accessibility, consistency).

## 13) Performance
- Minimize DB round-trips; batch to avoid N+1. Keep queries short-lived (pool limit 10).
- Keep client components small; avoid heavy computation in render paths. Prefer server-side prep.
- Stable hook dependencies; avoid dynamic hook ordering (React Compiler friendly).

## 14) Security
- Always parameterize SQL; validate client-provided IDs and phases before writes.
- Do not expose stack traces or sensitive data in responses/logs.
- Ensure required env vars exist before DB actions; never hardcode secrets.

## 15) Database & seeding safety
- Seed endpoints truncate tables and toggle FK checks—use only in dev.
- Migration script loads `.env.local` manually; ensure it exists before `npx tsx src/db/migrate.ts`.
- Connection pool is small; avoid long-held connections/transactions in API routes.

## 16) New code checklist (agents)
- Ensure `.env.local` is present if touching DB.
- Run `npm run lint`; run `npm run build` when touching TS/API/config.
- Keep imports ordered; use `@/` alias for internals.
- Add types; avoid `any` and ts-ignore.
- Validate inputs; return explicit status codes with JSON bodies.
- Keep styles consistent with theme; avoid inline styles unless necessary.

## 17) Missing rule files
- No `.cursor/rules`, `.cursorrules`, or `.github/copilot-instructions.md` present as of this version.

## 18) Documentation references
- Product requirements: `docs/PRD.md` (experiment flow, data logging expectations).
- UX heuristics: `GEMINI.md` (accessibility, keyboard, feedback timing, motion).
- DB schema & seeds: `src/db/migrate.ts`; CSVs under `docs/Study Material/*`.

## 19) Tailwind specifics
- Tailwind v4 inline theme via `@theme inline` in `globals.css`; keep new tokens consistent with existing palette.
- Prefer utility classes over custom CSS; if adding CSS, use theme vars.
- Maintain light palette; no dark-mode scaffold currently.

## 20) Deployment readiness
- `npm run build` is the gate; ensure it passes before handoff.
- Confirm env vars on deployment target (DB creds needed for API/seeders).

## 21) Tooling additions
- If adding tests/tooling, add npm scripts and document commands + single-test usage here.
- Keep configs minimal; avoid broad ignores hiding real issues.

## 22) React/Next patterns to follow
- Server components preferred; minimize client-side state.
- Avoid dynamic hook patterns; keep dependencies stable for React Compiler.
- Do not mix heavy refactors with bugfixes unless required.

## 23) Project scope reminders
- Current flow: consent → demographics → A (practice + recall, formal + recall) → B (practice + recall, formal + recall) → C (reading + recall + comprehension) → cognitive (letter comparison + vocabulary) → debrief. Cognitive tests live at `/assessment` and retain the existing `part_a_letter_item` / `part_a_vocabulary_*` storage. Only FinalAssessment is legacy. Timing/logging critical (see PRD).
- Maintain data logging and timing expectations when adjusting flows.

## 24) If you add tooling or tests
- Document new commands here and in package.json.
- Provide single-test invocation pattern if applicable.

## 25) Contact
- This file is authoritative for agents; update alongside stack/config changes.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Database Setup

This project uses MySQL. Ensure you have a MySQL server running and a `.env.local` file configured with the following variables:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=read-or-switch
```

### 1. Initialize Schema

Run the migration script to create tables:

```bash
npx tsx src/db/migrate.ts
```

### 2. Seed Data

Start the development server:

```bash
npm run dev
```

Then visit the following API endpoints in your browser or use `curl` to seed the database:

- **Part A:** [http://localhost:3000/api/seed-part-a-new](http://localhost:3000/api/seed-part-a-new)
- **Part B:** [http://localhost:3000/api/seed-part-b-new](http://localhost:3000/api/seed-part-b-new)
- **Part C:** [http://localhost:3000/api/seed-part-c](http://localhost:3000/api/seed-part-c)

These endpoints will reset the respective tables and populate them with initial study data.

## Experiment Flow

The study consists of the following stages:

1. **Informed Consent** — Participant agrees to the study terms
2. **Demographics** — Collection of basic user data
3. **Part A: Multi-text Learning Study** — Practice (4 minutes) → recall → formal reading (15 minutes) → recall
4. **Part B: Story Reading Study** — Practice stories with titles (4 minutes) → recall → formal stories with titles (15 minutes) → recall
5. **Part C: Sentence Reading Study** — Instructions → sentence reading (10 minutes) → recall → comprehension questions
6. **Debriefing & Thank You** — Study completion

All five recalls use the same speech-to-text editor and allow typing. Part A article ratings remain within each reading phase. Part B comprehension and the legacy Cognitive/Final assessments are no longer in the participant flow.

Material audit: `docs/Study Material/part_b_formal_stories.csv` currently has 24 of 48 segments containing only the placeholder `Text`; the local database matches this source. Complete those source passages before running a real study.

For existing databases, run `npm run db:migrate:part-a-recall-phases` before using Practice recall. This adds a phase column to `part_a_summaries` and preserves older records as formal recalls. Practice and formal recall submissions are saved separately.

The core research question examines how **predictable vs. unpredictable sentence endings** influence readers' decisions to **continue** reading the current story or **switch** to a different one.

## Summary voice input

A practice, A formal, B practice, B formal, and C recalls default to voice input. Add `OPENAI_API_KEY`
to `.env.local` (server only), restart the app, and start the study with a registered
participant. Audio goes directly from the browser to OpenAI over WebRTC; the server
creates a transcription-only session using `gpt-live-transcribe`. Live text is saved
through the existing summary endpoints; the app does not store audio.

Use a current Safari or Chromium browser on HTTPS, or `localhost` for development.
Allow microphone access, click to start, click again to stop, then review and submit.
Language is detected automatically. The text box stays editable during recording; manual edits are preserved as new speech arrives. Missing keys, denied permissions, interrupted
connections and final-transcript timeouts preserve captured text and show a message.

References: [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)
and [WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc).

## Part C reading times

Run `npm run db:migrate:part-c-timing` on an existing database to add columns safely
(Node 22.6+). Do not run the full migration on study data: it recreates tables.
New databases get the same columns from `src/db/schema.sql`; material CSV formats
and material seeders are unchanged because timing is collected at runtime.

`part_c_logs.word_reading_time_ms` stores each word's display-to-Space duration.
The last word's row also stores `sentence_reading_time_ms`, measured from the
first word appearing to the last Space press. Both are rounded integer milliseconds
from browser `performance.now()`. Word indices are zero-based. Sentence totals
include rendering intervals between words; continue/switch decision time and
network round trips before the next sentence are excluded. Time away from the tab
is included (the timer is not paused). Incomplete sentences have word logs but no
sentence total. Historical rows retain NULL durations; they are not backfilled.

Writes are queued without blocking word changes, and decision navigation waits
for saving. Failed writes stay queued for retry while the page is open. `event_id`
uniqueness prevents duplicate rows after retries. Reloading/closing before retrying
can discard unsaved events; the page displays a save error instead of advancing.

Tests: `npm test`; one file: `npm run test:one -- tests/part-c-timing.test.mjs`.

### Part C recall and completion

Run `npm run db:migrate:part-c-recall` on existing databases to add `part_c_summaries` without resetting data. Part C now runs sentence reading → recall (speech-to-text or typing) → comprehension questions. Recall must save successfully before questions appear. After the comprehension questions, participants go directly to `/complete` for debriefing. Legacy `/assessment` links redirect to completion. Part A has separate Practice and Formal recalls before Part B.

All study countdowns accumulate visible reading time only. Part A (4/15 minutes), Part B (4/15 minutes), and Part C (10 minutes) pause during instructions, topic/story selection, Continue/Switch decisions after sentences, questions/ratings, recall, content loading, and hidden tabs. Part C word/sentence timing uses the same active clock; decision and saving waits are excluded. A/B count while an article remains displayed. Background saves do not stop reading when a word remains displayed. Timeout clips partial-word durations to the remaining reading budget and saves logs before recall. Interrupted sentences use `action_type=timeout`, not a completed `word_reveal`. Saving failures retain data for retry.

### Existing database: update part names

Stop the app, then run `npm run db:migrate:part-names` once before starting the renamed app. This swaps the former A/C tables in one atomic rename, verifies their contents, and saves a local backup path in the output. It preserves participant IDs, response records, and original material TextIDs (such as `SP1SS0101`) for traceability; sentence material `StudyPartID` is now 3. Re-running is safe. New databases use the current schema directly. The active order is A (multi-text) → B (stories) → C (sentences) → Debriefing. Old A/C URLs now refer to the new task names, so restart an in-progress study from its appropriate new URL.

### Part A practice reading timer

Practice provides four cumulative minutes of visible article reading. Instructions, topic selection, loading, ratings, saving, and hidden browser tabs pause the timer. The counter resumes across articles and topics without resetting. At zero, the current article closes; participants complete its ratings, save them, then complete Practice recall before entering Formal. `part_a_prac_pass_qop.passRT` stores only that article’s reading milliseconds, frozen before ratings. Timer tests: `npm run test:one -- tests/active-reading-timer.test.mjs`.

### Railway update of an existing installation

The service uses Node 22 and npm. `railway.json` builds the standalone application, packages static assets and migration scripts, runs the non-destructive production upgrade, and checks `/` before routing traffic to the new app. Set `MYSQL_URL` from the existing MySQL service and `OPENAI_API_KEY` as server variables; never commit `.env.local`.

Before the first update from the old A/C naming, take a Railway MySQL volume backup. `npm run db:migrate:production` renames legacy A/C tables with content verification, adds Part C timing columns/recall storage and the Part A recall phase field. It can be rerun. It does not seed, truncate or reset existing tables. Do not run the general `db:migrate` or seed endpoints against an existing production database.

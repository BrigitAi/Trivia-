# Brigit Trivia League — Training Game

A gym-and-running-themed trivia league for Brigit staff: races, laps, sprint bonuses and personal bests. Every round earns points, and points add up across all games played. The more you play (and the better you play), the higher you climb. **Winner = highest total score.**

Runs in any browser: plain HTML + JavaScript, ready for GitHub Pages.

## Events (categories)
🔥 Fire Standards · 📋 Company Policies · 📦 Datasheets · 🧪 Safety Data Sheets · 🎓 Operational Manuals · ✅ Product Certification *(coming soon)* · 🎲 Mixed Bag

## Sectors
When competitors join, every sector starts ticked; they untick the ones they don't work in. Before each race they choose which sector they're **playing for**, and that race counts for that sector only. The Competitors table therefore has one row per competitor per sector, with a filter to show a single sector. Sectors also compete on their own table:
Technical Johannesburg · Exports · Passive Fire Containment · Special Risk · Sprinklers & Valves · Fire Detection · Gas Suppression · Portable Extinguishers

## Business divisions
Separate from sectors: every competitor picks **one** business division when joining: Finance/Admin, Operations, Procurement, Production or Sales. Existing players without one are asked at their next sign-in. The league table shows each player's division, has a division filter, and a **Divisions** tab with division totals. Edit the list in `questions.js` (`DIVISIONS`) and `quiz_division_list()` in Supabase.

## Scoring
- **100 points** per correct answer
- **Speed bonus** up to +100 (more time left = more points)
- **Combo:** 3 correct in a row = ×1.5, 5 in a row = ×2
- Wrong answer or time-out = 0 points and the streak resets
- Every round's points add to the player's season total in the sector they played for, **and** to that sector's total

## League tables
- **Competitors:** one row per competitor per sector: rank, sector, games played, accuracy, best round, total points. Filter: All sectors or one sector
- **Sectors:** total points, players, games, accuracy
- Filters: This week / This month / All time

## Required race: Company Policies
Company Policies is not a sector. It's a race **everyone must finish at least once**. It's pinned first with a *Required* badge, and players who haven't finished it see a reminder with a **Start now** button. Approvers see who has and hasn't completed it on `review.html` (with a CSV download). Mark any other category as required with `required: true` in `questions.js`.

## Training element
After every answer the explanation and reference (SANS standard, SDS section, manual) are shown. At full time, players get a review of every question they missed.

## Branding
- **Logo:** add Brigit's logo as `logo.png` next to `index.html`. It appears automatically top-left; without it, a 🏃 badge shows instead.
- **Colours:** ASH palette — teal `#1FD6C4` (main), dark navy backgrounds `#060F16` / `#0A141C` / `#0C1B26`, Brigit orange-red `#F85008` (icons), turquoise `#40E0D0` (correct), alert red `#C8102E` and warning orange `#FF8A4C` (missed), blue `#1E6FAE` (focus). All set at the top of the `<style>` block in `index.html` and `review.html`.

## Files
| File | Purpose |
|---|---|
| `index.html` | Layout and styling |
| `game.js` | Game logic, scoring, league tables |
| `questions.js` | Settings, sectors, categories and offline sample questions |
| `config.js` | Supabase connection (empty = offline mode) |
| `review.html` | Question approval page for approvers |
| `supabase/schema.sql` | Database tables and access rules |
| `supabase/sectors.sql` | Multiple sectors per competitor (run once after schema.sql) |
| `supabase/sectors_edit.sql` | Lets players change their own sectors (run once after sectors.sql) |
| `supabase/upload.sql` | Lets approvers upload their own questions (run once) |
| `supabase/players.sql` | Registered players list for approvers on review.html (run once) |
| `supabase/stats.sql` | Stats views for ASH and reports, plus the per-answer log (run once) |
| `supabase/divisions.sql` | Business divisions (Finance/Admin, Procurement, Production, Sales); lists live in `quiz_sector_list()` / `quiz_division_list()` (run once) |
| `supabase/generators.sql` | Who may generate questions (`quiz_generators`), Deon as approver, Operations division (run once) |
| `supabase/guests.sql` | Guests: non-Brigit people who may play, e.g. carlos@elveygroup.com (run once) |
| `supabase/generate.sql` | Support for the question generator (run once after schema.sql) |
| `supabase/functions/quiz-generate/index.ts` | Edge Function that writes new draft questions with AI |

Question format:
```js
{ q: "Question?", options: ["A", "B", "C", "D"], answer: 0, explain: "…", ref: "SDS Section 8" }
```
`answer` is the index of the correct option (options are shuffled each game). Add `draft: true` to hide a question; `comingSoon: true` on a category greys it out.

## Online mode (Brigit's Supabase)
The game runs **offline** (sample questions, scores per device) until `config.js` is filled in. Online it uses the same Supabase database as ASH:

- **Questions** come from `quiz_questions`. Only questions with status *approved* are played.
- **Results** go to `quiz_results`, and every competitor sees one shared league table.
- **Accounts:** players **register once** with their Brigit email and a password, then confirm with a code emailed to them. After that they sign in with email + password (browsers offer to save it, and players stay signed in). **Forgot password** emails a code to set a new one. Only `@brigit.co.za` addresses are accepted, plus the admin addresses in `config.js` (`adminEmails`), which must also be approvers. First-timers choose a display name and one or more sectors. The name is fixed; players can change their sectors any time with **Change my sectors** (races already played keep their sector).
- **Email templates:** in Supabase → Authentication → Emails, the *Confirm signup* and *Reset password* templates must include `{{ .Token }}` so the email shows the code.
- **Approvers** (listed in `quiz_approvers`) get a *Review questions* button that opens `review.html`. There they can edit, approve or reject draft questions.

Status (13 Oct 2026):
- Done: the `quiz_*` tables, access rules and approvers (Donald, Corne, Feri and admin sysproai@elveygroup.com; brigitai@ is a normal test competitor) are live in Brigit's Supabase, and `config.js` is filled in with the project URL and publishable key.
- Done: 114 draft questions written from ASH's library (Fire Standards 23, SDS 22, Company Policies 25, Operational Manuals 23, Datasheets 21). They go live once approved on `review.html`.
- To do: add the GitHub Pages address in Supabase → Authentication → URL Configuration (Site URL and Redirect URLs), or sign-in links won't return to the game.
- To do: set up custom SMTP in Supabase → Authentication → Emails before rollout. The built-in mailer only sends a handful of sign-in emails per hour.

## Registered players
Approvers see a **Registered players** section on `review.html`: everyone who registered with a Brigit email, whether they confirmed their email, joined the league, have played, and have done Company Policies. Filter, search, and **Download list (CSV)**. Needs `supabase/players.sql` (run once).

## Approving and uploading questions
On `review.html`, approvers can edit, approve or reject each draft, or click **Approve all** to approve every draft in the library being viewed (or all libraries).

**Upload your own questions:** download the Excel template, fill in one question per row (library, question, correct answer, 3 wrong answers, explanation, reference), then upload the .xlsx or .csv file. A preview flags problems (unknown library, missing answers, duplicates) before anything is saved. Questions are added as drafts, or approved straight away if that box is ticked.

## Generating new questions
Only people listed in `quiz_generators` (Donald Barnard, Deon van Zyl and the admin account) see the **Generate** panel and can call the generator. Other approvers can still edit, approve, reject and upload.

Approvers see a **Generate new questions** panel at the top of `review.html`. They pick a library (or *All libraries*) and how many questions, then click **Generate**. The Edge Function picks unused, substantive passages from ASH's library, asks an AI model for one multiple-choice question per passage, and saves them as **drafts**. Nothing goes live until an approver approves it. Each passage is used only once.

One-time setup:
1. Run `supabase/generate.sql` in the Supabase SQL editor.
2. Supabase → **Edge Functions → Deploy a new function → Via editor**, name it `quiz-generate`, paste `supabase/functions/quiz-generate/index.ts` and click **Deploy**.
3. Supabase → **Edge Functions → Secrets**, add `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` plus `LLM_PROVIDER` = `openai`). Optional: `QUIZ_MODEL` to choose the model.

Every run is logged in the `quiz_generation_runs` table (who, which library, how many).

The publishable key in `config.js` is designed to be public. Never put a secret (`sb_secret_…`) or service-role key in this repository.

## Stats for ASH
`supabase/stats.sql` creates read-only views in the same Supabase database ASH uses. Times are South African time.

| View | Answers |
|---|---|
| `quiz_stats_leaderboard` | Who is in the lead (season, month, week points; races; accuracy) |
| `quiz_stats_leaderboard_by_sector` / `quiz_stats_sectors` | Leaders per sector, and the sector table |
| `quiz_stats_most_played` | Who played each race the most |
| `quiz_stats_question_repeats` | Who answered the same question most often |
| `quiz_stats_questions` | Most played and most missed questions |
| `quiz_stats_play_hours` / `quiz_stats_play_times` | What time of day (and weekday) people play most |
| `quiz_stats_required_completion` | Who has / hasn't completed Company Policies |
| `quiz_stats_summary()` | All of the above in one JSON call |
| `quiz_leaderboard_table(period, top, division, sector, race, view)` | A ready-to-show Markdown leaderboard table for ASH's answers (period: season/month/week; view: competitors/sectors/divisions) |

Question-level stats come from `quiz_answers`, which the game fills from the moment stats.sql is run.

## Publish on GitHub Pages
1. Create a repository and upload these files.
2. **Settings → Pages → Deploy from a branch → main / (root) → Save.**
3. The game is live at `https://<username>.github.io/<repo>/` within a minute.

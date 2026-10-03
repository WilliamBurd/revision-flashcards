# Revision Flashcards

A personal flashcard app for revising A-Level History and Politics. It uses
spaced repetition (the FSRS algorithm) so each review shows the cards you're
closest to forgetting. It works on a phone and a desktop, and everything is
saved on the device, so it works with no signal.

**Status: Phase 4.** Subjects, sets, quick add, editing and FSRS review all
work, plus cloze cards, reversed cards, pasting many cards at once, tags,
bold and italics, and Browse with search. Phase 4 added cram mode, undo, an
end-of-session summary, exam dates, stats with a leeches list, a settings
screen, and JSON and CSV import and export. Anyone can create an account with
an email and password; each person's cards sync between their devices and
nobody can see anyone else's. The app installs to your home screen and works
with no signal.

## Using it

- **Home** (titled Burdis Flashcards) lists your subjects and sets with how many cards are due. Each
  subject with cards ready has its own big **Review** button at the top, so
  subjects are never mixed in one review.
- **Add** (or the round + button on a phone) first asks which set the cards
  are for, then shows "Adding to History · Tudors" with **Change** at the
  top. (From a set's **Add cards** button, that set is already chosen.)
  **Done** at the top goes back. It has three tabs:
  - **Card**: Front and Back. After each card the form clears and keeps the
    same set and tags, so you can type card after card. Tick **Also make a
    reversed card** to get a second card that shows the Back and asks for the
    Front. On a computer, Tab moves from Front to Back and Ctrl+Enter
    (Cmd+Enter on a Mac) saves.
  - **Blanks** (also called cloze cards): write a fact as a sentence and tap
    **Next**, then tap the words to hide. Hidden words next to each other
    join into one blank ("William" and "III"), and tapping a hidden word
    again shows it. A preview shows each card it will make, with
    **+ Add a hint** to show something like [year] instead of [...]. On a
    computer you can also type blanks as `{{1688}}`, or `{{1688::year}}`
    for a hint.
  - **Paste many**: paste one card per line as `Front - Back` (a tab, or the
    long dashes Word makes, work too). A line with `{{blanks}}` makes cloze
    cards. Bullets and numbers at the start of lines are ignored. The
    preview shows every card before you add them, and any line that didn't
    split is shown in red and left out.
- **Bold, italics and bullets**: use the B, I and • buttons (on a phone they
  also sit just above the keyboard while you type), or Ctrl+B and Ctrl+I. Plain
  text works exactly as before.
- **Tags** are optional labels like "key date" or "exam Q". Add them under
  the set when adding or editing a card.
- **Browse** lists every card. Search by any words on either side, filter by
  set or tag (tap a tag to see all cards with it), and tap a card to edit
  it. Press and hold a card (or tap **Select**) to choose several, then move
  them to another set, add or remove a tag, or delete them.
- **Review**: tap the card (or press Space) to see the answer, then rate how
  well you knew it. Each button shows when the card will come back.

  | Button | Key | Meaning |
  | --- | --- | --- |
  | No Idea | 1 | Forgot it. It comes back in a minute. |
  | Barely | 2 | Got it, with difficulty. |
  | Kind Of | 3 | Got it. |
  | Confident | 4 | Easy. It comes back much later. |

  Press E (or the pencil) to fix a typo mid-review; it doesn't reset the
  card's schedule. Press Z (or the curved arrow) to undo the last rating and
  see that card again. Escape leaves the review. At the end you get a
  summary: cards reviewed, how many were No Idea, and the time taken.
- **Cram**: on a set's page, **Cram all** goes through every card in the set
  in a random order, whether due or not. No Idea brings a card back a few
  cards later. Cram ratings are saved in your history but never change when
  a card is next due.
- **Exam dates**: in a subject's ⋯ menu on Home, add its exam dates. Home
  then counts down to the next one. A set can use its own date instead (on
  the set's page). See "How cards are scheduled" for what exam dates change.
- **Stats**: your streak, today's reviews, how many cards are due each day
  for the next week, known / learning / new per set, and the leeches list
  (cards you keep forgetting), each linking to its edit screen.
- **Settings** (the sliders button on Home, or in the sidebar): target
  retention (80% to 95%), the longest gap between reviews, the daily new card
  limit across all sets, the theme, your account, and backups.
- **Backup and CSV**: Settings → **Export everything** saves a `.json` file
  with every card and its progress; **Import a backup** merges one back in
  (nothing is duplicated or deleted, and newer progress on the device is
  kept). On a set's page you can export or import a CSV file with columns
  front, back, tags, for spreadsheets or other apps; a front with
  `{{blanks}}` becomes a blanks card.

- **Theme**: tap the palette button on Home (or Theme in the sidebar on a
  computer) to pick White, Light grey, Medium grey, Dark grey, Black, Navy or
  Midnight. "Match device" uses White in light mode and Midnight in dark mode. The choice is saved on
  each device. All colours, fonts and corner shapes come from the theme
  variables at the top of `src/index.css`, so adding a theme means adding
  one more block there.

### How cards are scheduled

- New cards are shown again after 1 minute and 10 minutes, then move to daily
  intervals.
- The app aims for you to remember 90% of cards when they come up, and never
  waits more than 45 days between reviews.
- Up to 20 new cards are introduced a day in each subject (change it in
  Settings), so studying History never uses up Politics' new cards. Each set
  has its own limit too (20 by default; change it on the set's page). When you
  hit the limit, the end of a review offers **Learn more today**, which is
  handy when you've just added a lot of cards.
- The blanks of one cloze sentence, and a card and its reverse, never come
  up in the same day's review: once you've seen one, the others wait until
  tomorrow so they don't give each other away.
- A study day starts at 4am, so a late-night session still counts as that
  day.
- A card rated No Idea 6 times is flagged as a "leech" and listed on Stats so
  you can rewrite it.
- **Before an exam**: no card is scheduled after it (anything that would be
  is brought forward to the day before), so every card comes up at least
  once in the final week. In the last 14 days, target retention rises to 95%,
  so cards come back more often. Once an exam has started, the next one takes
  over; with none left, scheduling goes back to normal.

## Running it on your computer

You only need this if you want to change the code. The live site deploys by
itself (see below).

1. Install [Node.js](https://nodejs.org/) (the "LTS" version, 20 or newer).
2. Open a terminal in this folder and install the app's packages:

   ```sh
   npm install
   ```

3. Start the app:

   ```sh
   npm run dev
   ```

   Open the address it prints (usually http://localhost:5173). The page
   reloads as you edit files in `src/`.

4. To try it on your phone over home Wi-Fi, run `npm run dev -- --host` and
   open the "Network" address it prints on your phone.

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Runs the unit tests once |
| `npm run test:watch` | Re-runs tests whenever you save a file |
| `npm run typecheck` | Checks the TypeScript for mistakes |
| `npm run build` | Builds the production site into `dist/` |
| `npm run preview` | Serves the built site locally |

## Deploying

The site is hosted on Vercel, connected to this GitHub repo. Every push to
`main` redeploys the live site, and every pull request gets its own preview
link (Vercel posts it on the pull request). There's nothing to run by hand.
`vercel.json` makes sure links like `/sets/...` load the app instead of a
404 page.

## Setting up accounts and syncing (Supabase)

Accounts and syncing use a free [Supabase](https://supabase.com) project.
Until it's set up, the app still works, but only on one device and with no
login. You only do this once.

1. **Create the project.** Sign in at supabase.com, click **New project**,
   give it a name (e.g. `revision-flashcards`), choose a database password
   (save it somewhere; the app doesn't need it) and the region nearest you
   (e.g. London), then **Create new project**. Wait a minute while it starts.
2. **Create the tables.** In the left sidebar open **SQL Editor**, click
   **New query**, paste in the whole of [`supabase/schema.sql`](supabase/schema.sql)
   and click **Run**. It should say "Success. No rows returned". This makes
   the tables and the rules that keep each person's cards private.
3. **Let friends sign up without an email link.** Open **Authentication >
   Sign In / Providers** (called **Providers > Email** in some versions) and
   turn **off** "Confirm email", then **Save**. Supabase's free email
   service only sends to the project owner's address, so with confirmation
   on, your friends would never get their link.
4. **Let password reset links open the app.** Open **Authentication > URL
   Configuration**. Set **Site URL** to the live address
   (`https://burdis-flashcards.vercel.app`) and add the same address under
   **Redirect URLs**, then **Save**. Without this, "Forgot password?" emails
   link to `localhost`. Supabase's free email service only sends to the
   project owner's address, so friends' reset emails need a free SMTP
   service such as Resend added under **Authentication > Emails > SMTP
   Settings**.
5. **Copy the keys.** Open **Project Settings > API** (or click **Connect**
   at the top). Copy the **Project URL** and the **anon public** key. The
   anon key is safe to put in the app: the rules from step 2 are what
   protect the data.
6. **Give the keys to Vercel.** In your Vercel project open **Settings >
   Environment Variables** and add two variables, ticking Production,
   Preview and Development for each:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon public key

   Then open **Deployments**, click **⋯** on the latest one and choose
   **Redeploy**. The app now shows a sign-in screen.
7. **For local development** (optional), copy `.env.example` to
   `.env.local` and paste the same two values in.

### How syncing works

- Everything is saved on the device first, so the app works offline. Each
  change is marked as waiting to upload.
- When online, the app uploads waiting changes and downloads anything new
  shortly after each change, when you reopen it, when you come back online,
  and every 30 seconds while it's open. A card added on your laptop shows up
  on your phone within about 30 seconds.
- The small badge at the top of Home says **Synced**, **3 to sync**, or
  **Offline**. Tap it to sync now or sign out.
- If the same card was edited on two devices, the most recent edit wins. If
  it was *reviewed* on two devices while offline, both reviews are kept and
  the card's schedule is rebuilt from them in time order.
- Signing out removes your cards from that device (they stay in your
  account), so a friend can sign in on the same phone without seeing them.
  Cards made before signing in for the first time are uploaded into that
  first account.

## Updates

The app checks for a new version when you open it or switch back to it, and
every hour while it's open, then reloads itself. Your cards and progress are
never touched by an update.

## Question suggestions (Gemini, free)

On the Card tab, type the answer on the Back and tap **✨ Suggest a question**.
The app asks Google's Gemini for three short questions that each ask for just
that one answer, and tapping one puts it on the Front. It never changes how
cards are scheduled.

To switch it on (free, no card needed):

1. Go to https://aistudio.google.com/apikey, sign in with a Google account and
   click **Create API key**. Copy the key.
2. In Vercel, open the project → **Settings → Environment Variables**, add
   `GEMINI_API_KEY` with that key, and save.
3. Redeploy (**Deployments → ⋯ → Redeploy** on the latest one).

The key stays on Vercel's server (`api/suggest-question.ts`) and is never sent
to the browser. Only signed-in users can ask for suggestions, and only the
answer text, subject and set name go to Google. Optional: set `GEMINI_MODEL`
to use a different Gemini model (the default is `gemini-flash-latest`).

## Installing on your phone

Open the site in Chrome on Android, tap **⋮** then **Install app** (or **Add
to Home screen**). If Chrome doesn't offer it, Firefox does: **⋮ → Add app to
Home screen**. It then opens full screen from its own icon, and works
with no signal once it has been opened online at least once.

## Where your data lives

Cards and progress are stored in the browser's IndexedDB on each device, and
in your Supabase project once you're signed in. Clearing the browser's site
data only removes the copy on that device; signing in again downloads it.

## How the code is organised

```
src/
├── db/          everything stored on the device (Dexie / IndexedDB)
│   ├── types.ts     the shape of subjects, sets, notes, cards, review logs
│   ├── db.ts        the database and its indexes
│   ├── subjects.ts  create, rename and delete subjects and sets
│   ├── notes.ts     add, edit and delete cards
│   ├── study.ts     due counts, daily new-card limits, saving and undoing ratings
│   ├── stats.ts     streak, forecast and leeches for Stats
│   └── settings.ts  scheduling settings and the last-used set
├── backup/      JSON backups and CSV import and export
├── notes/       card text: formatting, cloze blanks, pasted lines, and which
│                cards a note makes (edits keep each card's schedule)
├── scheduler/   the FSRS wrapper (built on ts-fsrs), exam-date rules, interval labels
├── session/     which card comes next in a review, cram order, and the review state
├── sync/        accounts and syncing with Supabase
│   ├── engine.ts           upload, download, merge, and when to sync
│   ├── replay.ts           rebuilds a card's schedule from its review history
│   ├── remote.ts           talks to Supabase
│   └── AccountProvider.tsx sign in / sign up / sign out for the app
├── lib/         small helpers (IDs, when the study day starts, themes)
├── components/  shared pieces of the interface
└── pages/       one file per screen
```

A **note** is what you type in; a **card** is what gets studied. A basic note
makes one card (two if reversed); a cloze note makes one card per blank.
Editing a note keeps its cards' progress: in a cloze sentence each blank is
matched to its card by its text first, then its position, so fixing a typo
or adding a blank doesn't reset the others.

Card text is stored as plain text with `**bold**`, `_italics_` and lines
starting `- ` for bullets (see `src/notes/format.ts`), so it stays readable
in the database and in exports. It is always shown with React elements,
never as raw HTML, so nothing typed on a card can run as code. The Front and
Back boxes use [Tiptap](https://tiptap.dev), a free open-source editor, which
only loads on the Add and Edit screens.

Every record has an ID made on the device plus `created_at`, `updated_at`,
a `deleted` flag (so deletions sync) and a `dirty` flag (changes not yet
uploaded). `supabase/schema.sql` is the matching cloud database.

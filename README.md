# Revision Flashcards

A personal flashcard app for revising A-Level History and Politics. It uses
spaced repetition (the FSRS algorithm) so each review shows the cards you're
closest to forgetting. It works on a phone and a desktop, and everything is
saved on the device, so it works with no signal.

**Status: Phase 1.** Subjects, sets, quick add, editing and FSRS review all
work, with everything saved on this device. Install-to-home-screen, login and
syncing between devices come in Phase 2.

## Using it

- **Home** lists your subjects and sets with how many cards are due. The big
  **Review all due** button starts a review of everything.
- **Add** (or the round + button on a phone) adds cards. After each card the
  form clears and keeps the same set, so you can type card after card. On a
  computer, Tab moves from Front to Back and Ctrl+Enter (Cmd+Enter on a Mac)
  saves.
- **Review**: tap the card (or press Space) to see the answer, then rate how
  well you knew it. Each button shows when the card will come back.

  | Button | Key | Meaning |
  | --- | --- | --- |
  | No Idea | 1 | Forgot it. It comes back in a minute. |
  | Barely | 2 | Got it, with difficulty. |
  | Kind Of | 3 | Got it. |
  | Confident | 4 | Easy. It comes back much later. |

  Press E (or the pencil) to fix a typo mid-review; it doesn't reset the
  card's schedule. Escape leaves the review.

- **Theme**: tap the palette button on Home (or Theme in the sidebar on a
  computer) to pick Colourful, Midnight or Notebook. "Match device" uses
  Colourful in light mode and Midnight in dark mode. The choice is saved on
  each device. All colours, fonts and corner shapes come from the theme
  variables at the top of `src/index.css`, so adding a theme means adding
  one more block there.

### How cards are scheduled

- New cards are shown again after 1 minute and 10 minutes, then move to daily
  intervals.
- The app aims for you to remember 90% of cards when they come up, and never
  waits more than 45 days between reviews.
- Up to 20 new cards are introduced a day across all sets, and each set has
  its own limit too (20 by default; change it on the set's page). When you
  hit the limit, the end of a review offers **Learn more today**, which is
  handy when you've just added a lot of cards.
- A study day starts at 4am, so a late-night session still counts as that
  day.
- A card rated No Idea 6 times is flagged as a "leech" so you can rewrite it
  later (the leeches list arrives in Phase 4).

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

Setting up Supabase for syncing will be added here in Phase 2.

## Where your data lives

Cards and progress are stored in your browser's IndexedDB, on that device
only, until syncing arrives in Phase 2. Clearing the browser's site data
for this app deletes them.

## How the code is organised

```
src/
├── db/          everything stored on the device (Dexie / IndexedDB)
│   ├── types.ts     the shape of subjects, sets, notes, cards, review logs
│   ├── db.ts        the database and its indexes
│   ├── subjects.ts  create, rename and delete subjects and sets
│   ├── notes.ts     add, edit and delete cards
│   ├── study.ts     due counts, daily new-card limits, saving ratings
│   └── settings.ts  scheduling settings and the last-used set
├── scheduler/   the FSRS wrapper (built on ts-fsrs) and interval labels
├── session/     which card comes next in a review, and the review state
├── lib/         small helpers (IDs, when the study day starts)
├── components/  shared pieces of the interface
└── pages/       one file per screen
```

A **note** is what you type in; a **card** is what gets studied. For now one
note makes one card. Phase 3 adds reversed and cloze cards, where one note
can make several.

Every record has an ID made on the device plus `created_at`, `updated_at`
and a `deleted` flag, so syncing in Phase 2 needs no changes to stored data.

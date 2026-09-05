# Max TH

A local-first Clash of Clans Home Village planner organized around one question:

> Given my actual village, what should I upgrade next to max this Town Hall while front-loading offense and delaying defensive war weight?

## What it does

- Reads the in-game Clash of Clans JSON Data Export from the clipboard/paste box.
- Stores the last confirmed village and scheduler settings in IndexedDB. There is no auth or backend.
- Detects permanent builders from the village export and honors an active `extra:true` Goblin Builder only for the task currently shown in the export.
- Keeps laboratory and pets as independent progression lanes.
- Plans four builder phases:
  1. **Offensive Foundation** — make the TH base legal; max attack-enabling buildings; leave newly placed defenses at level 1.
  2. **Economy & Passive HP** — max storages and collectors while offense continues progressing.
  3. **Traps & Teslas** — traps first, Hidden Teslas last.
  4. **Defensive Completion** — ordinary defenses first, inferred high-war-weight/signature defenses last.
- Uses one hero builder lane during Phase 1, then saturates available heroes once Phase 1 is complete.
- Prioritizes laboratory upgrades using a Town Hall-specific war-meta profile (Dragons/Balloons and other commonly useful war troops ahead of low-value research).
- Adds a 10-minute human-action buffer after upgrades and waits until wake time + 10 minutes when an upgrade finishes during the configured sleep window.
- Can reserve a builder around a daily wall-farming session and estimates wall completion from a conservative 300k Gold + 300k Elixir per five-minute farming cycle by default.
- Treats walls, heroes, lab, pets, and builder-track completion as independent clocks that all gate **TH Ready**. Hero equipment and Supercharges do not gate TH readiness.
- Shows a TH-scoped “wiki inverted” view: current level, TH maximum, and the relevant lab/TH requirement.

## App architecture

The app is intentionally boring infrastructure:

- `index.html` — four-tab mobile-first shell
- `app.css` — responsive minimal UI
- `app-data.js` — game-data loader, export parser, IndexedDB state, and priority configuration
- `app-planner.js` — upgrade chains, sleep/wall constraints, and builder/lab/pet scheduling
- `app-ui.js` — dashboard, plan, Max TH, settings, import, and celebration rendering
- `manifest.webmanifest` + `sw.js` — installable PWA/offline shell
- `assets/icon.svg` — app icon

The UI has four tabs:

- **Dashboard** — phase progress, Heroes/Lab/Walls/Defenses progress, milestone dates, and what every worker is doing now + next.
- **Plan** — phase definitions and near-term queue preview.
- **Max TH** — Town Hall-scoped max levels and requirements.
- **Village** — paste/import plus sleep, Gold Pass, helper, and wall-session settings.

## Game data

The app loads structured Home Village data from [`clash-of-clans-data`](https://github.com/chiefpansancolt/clash-of-clans-data), currently pinned to npm version `0.16.0`, and caches the normalized data locally after first load.

That project is MIT licensed and derives its game data from the Clash of Clans Wiki. Max TH is not affiliated with, endorsed by, or sponsored by Supercell. Clash of Clans is a trademark of Supercell.

## GitHub Pages

This repository is a static site. To publish it, enable GitHub Pages for the repository and serve the root of `main`. No build step is required.

## Current scheduler assumptions

The scheduler is intentionally explicit rather than pretending to know Supercell's private matchmaking coefficients:

- Farming resources are treated as available; storage capacity is the only resource constraint intended to block an upgrade.
- Defensive priority is a transparent low-war-weight heuristic, not a numerical “war weight” claim.
- An imported active timer is authoritative. Future times are projections until a new export confirms completion.
- Temporary Goblin Builder capacity is never projected beyond the imported `extra:true` task.
- Gold Pass reductions apply to future projected durations; active timers already contain their real remaining time.
- If automatic helper use is enabled, the Lab Assistant is modeled as removing its level in research-hours every 23-hour helper workday.

## Development

There is no package manager or build chain. Serve the repo with any static web server if you want service-worker behavior locally, for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

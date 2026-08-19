# KRITHOHUNT

KRITHOHUNT is a mobile-first React treasure hunt for campus events. Teams choose one of six color paths, scan physical location QR codes, solve five digital challenges, and return to the organizers for final verification.

## Features

- Six paths: red, blue, green, yellow, purple, and orange.
- Thirty seeded clues: five stages per path.
- Server-generated five-digit team IDs allow duplicate team names and resume on another device.
- Random 36-character location QR tokens are checked server-side.
- Every team receives a server-authoritative 45-minute deadline from registration. Expired sessions close with their current progress preserved.
- Sudoku, Connect Dots, Campus GeoGuessr, Tower of Hanoi, and Safe Cracker.
- Organizer dashboard with polling, search, filtering, CSV export, team actions, and printable QR sheets.
- Local persistence for the active team and unfinished Sudoku/Connect Dots input.
- Keyboard focus rings, reduced-motion support, and 44px touch targets.

## Stack

- React 19 and Vite 8
- Tailwind CSS 4
- Supabase PostgreSQL and RPC functions
- Leaflet with a static campus image
- `html5-qrcode` for camera scanning
- Lucide React icons
- Oxlint

## Setup

Requirements: Node.js 22+ and a Supabase project.

```bash
npm install
cp .env.example .env
npm run dev
```

Create `.env` with:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_PASSWORD=your-local-organizer-password
VITE_PUBLIC_APP_URL=https://your-deployed-app.example.com
```

`VITE_ADMIN_PASSWORD` is a client-side convenience gate, not a production secret. Use Supabase Auth or a server-side admin endpoint for a public deployment.
Set `VITE_PUBLIC_APP_URL` to the URL that phones will open when scanning printed codes. Without it, development QR codes use the current browser origin, such as `127.0.0.1`, which other devices cannot reach.

## Database setup

Run the complete [`supabase-migration.sql`](supabase-migration.sql) in the Supabase SQL editor. It creates:

- `teams` and `clues` tables with RLS.
- Public team select/insert policies required by registration and dashboard polling.
- Explicit table grants and RPC execute grants.
- `get_current_clue`, `scan_location_qr`, `submit_team_answer`, `submit_connect_dots`, and `admin_delete_team`.
- `register_team`, `resume_team`, and `get_location_qr_tokens`.
- `admin_reset_teams` performs one transactional event reset instead of one request per team.
- Thirty clues across all six paths.
- Thirty random location QR tokens, one for each path and stage.

Do not run older deleted schema variants alongside the migration. Use one database definition so RPC validation cannot be overwritten by a simplified version.
After running it, print a fresh QR sheet. Older `/scan?color=...&stage=...` codes are intentionally no longer accepted.

## Routes

- `/` home and session resume.
- `/start?color=red` team registration.
- `/play` active hunt.
- `/scan?token=<issued-token>` direct location verification.
- `/admin` organizer dashboard.
- `/demo/safe-cracker` local Safe Cracker demo.

## QR sheets

The admin dashboard generates six start QR codes and thirty issued-token location QR codes locally in the browser. Each card can share its URL through the native share sheet or copy it to the clipboard. Printing waits for all 36 tokens and QR images and refuses to print if a code failed.

The camera scanner requests permission directly from the Scan button before starting `html5-qrcode`. It requires HTTPS on real phones; if permission was previously blocked, participants must allow Camera in the browser site settings and tap Try Again. It accepts only same-origin `/scan?token=...` URLs with a 36-character issued token. Camera permission denial or startup failure never unlocks a challenge.

## Verification

```bash
npm run lint
npm run build
```

There is no automated browser or database test suite yet. Before an event, use a disposable Supabase project and test registration, wrong path, wrong stage, wrong answer, valid answers for each game type, team deletion, team completion, and printed QR output.

For 100–200 concurrent teams, the app uses bounded polling rather than one realtime subscription per player. The migration adds indexes for team IDs, progress sorting, finish sorting, and QR token lookup. The remaining production security boundary is the anonymous admin client; use Supabase Auth or a server-side admin endpoint before treating admin actions as protected.

## Project structure

```text
src/
├── App.jsx                         Client-side router and app shell
├── main.jsx                        React entry point
├── index.css                       Design tokens and global/print styles
├── supabaseClient.js               Supabase client initialization
└── components/
    ├── primitives/                 Shared UI controls
    ├── games/                      Tower of Hanoi and Safe Cracker
    ├── AdminDashboard.jsx          Organizer workflow and QR sheets
    ├── PlayScreen.jsx              Team state, scanner, and progression
    ├── ScanScreen.jsx              Direct QR verification
    ├── GameRenderer.jsx             Lazy game router
    ├── SudokuGame.jsx
    ├── ConnectDotsGame.jsx
    └── CampusGeoguessrGame.jsx
```

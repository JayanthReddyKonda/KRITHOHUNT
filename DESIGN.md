# KRITHOHUNT Design Contract

**Status:** Implemented baseline
**Last updated:** 2026-08-18

## Visual system

KRITHOHUNT uses a dark, high-contrast game interface with a teal brand accent and six path accents:

| Purpose | Token | Value |
| --- | --- | --- |
| Brand and neutral states | `--accent-brand` | Teal |
| Red path | `--accent-rose` | Rose |
| Blue path | `--accent-cyan` | Cyan |
| Green path | `--accent-emerald` | Emerald |
| Yellow path | `--accent-amber` | Amber |
| Purple path | `--accent-violet` | Violet |
| Orange path | `--accent-orange` | Orange |

All tokens are defined in `src/index.css` and exposed through Tailwind in `tailwind.config.js`. Yellow and orange text must use inverse text on filled backgrounds for contrast.

## Interaction rules

- Interactive controls use the shared primitives in `src/components/primitives/`.
- Buttons and game cells have a minimum 44px touch target.
- Focus-visible rings use the brand accent.
- Reduced-motion users receive near-instant transitions and no repeated animation.
- Game progress is server-authoritative. Local storage preserves only the active team ID and unfinished puzzle input.

## Screen contracts

### Start and play

- `/start?color=<path>` registers a team or resumes it with its five-digit ID. Duplicate display names are allowed.
- `/play` displays the current clue, location lock, QR scanner, game, penalties, and progress.
- Physical QR scans carry a random issued token; `scan_location_qr` resolves it and checks team path and expected stage.
- The direct `/scan` route and the in-app camera route use the same RPC.

### Admin

- `/admin` contains the organizer login, team monitor, filters, sorting, completion actions, CSV export, and QR generator.
- QR sheets contain six start codes and thirty issued-token location codes.
- QR codes are generated locally, can be shared through the native share sheet or clipboard, and printing is handled by global `@media print` rules in `src/index.css`.
- Printed QR URLs use `VITE_PUBLIC_APP_URL` when configured so a phone never receives an unreachable development origin such as `127.0.0.1`.
- The camera scanner rejects non-origin URLs, non-`/scan` paths, malformed tokens, and all camera permission failures.
- Camera permission is requested from the user gesture; denied, insecure, unsupported, and missing-camera states have explicit recovery messages.

### Games

- Sudoku: 4x4 grid.
- Connect Dots: orthogonal paths with no shared cells.
- Campus GeoGuessr: five rounds using a Leaflet `CRS.Simple` campus image.
- Tower of Hanoi: three disks, three pegs.
- Safe Cracker: four sequential clue digits.

## Backend contract

Run `supabase-migration.sql` in a disposable Supabase project before event use. It creates the `teams` and `clues` tables, RLS policies, explicit anon/authenticated grants, six paths with thirty clues, and these RPCs:

- `get_current_clue`
- `scan_location_qr`
- `submit_team_answer`
- `submit_connect_dots`
- `admin_delete_team`

The migration sets `search_path` on `SECURITY DEFINER` functions and validates standard answers, GeoGuessr coordinates, and Connect Dots paths server-side.

It also creates `location_qr_tokens`, seeds thirty random tokens, exposes `register_team`, `resume_team`, and `get_location_qr_tokens`, and adds indexes for team code, progress, finish sorting, and token lookup. The current bounded polling model is appropriate for approximately 100–200 concurrent teams.

The admin reset uses `admin_reset_teams` as one transaction, avoiding a request-per-team loop during event operations.

## Known deployment boundary

The current organizer password is checked in browser code and stored as a session flag. `VITE_ADMIN_PASSWORD` is therefore not a true secret after bundling. For a public deployment, replace this gate with Supabase Auth or a server-side admin endpoint before relying on delete or finish actions.

## Validation

```bash
npm run lint
npm run build
```

The repository currently has no automated browser or database test suite. Validate the SQL functions in a disposable Supabase project with wrong path, wrong stage, wrong answer, valid answer, delete, and finish cases.

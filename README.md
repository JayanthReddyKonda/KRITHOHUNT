# KRITHOHUNT — College Treasure Hunt App

A mobile-first React + Vite application for campus treasure hunt events with QR code progression, real-time game challenges, and an organizer admin dashboard.

## Features

- **6 Color Paths** (Red, Blue, Green, Yellow, Purple, Orange) — 5 clues each = 30 total challenges
- **QR Code Progression** — Scan physical location QRs to unlock digital challenges
- **5 Game Types** — Sudoku, Connect Dots, Campus GeoGuessr, Tower of Hanoi, Safe Cracker
- **Real-time Admin Dashboard** — Desktop-first with sidebar navigation, responsive card list on mobile, printable QR sheets
- **Secure Backend** — Supabase with RLS and SECURITY DEFINER RPC functions
- **Offline Support** — LocalStorage persistence for game state
- **Accessibility** — WCAG AA contrast, 44px touch targets, focus-visible rings, reduced motion

## Tech Stack

- **Frontend**: React 19, Vite 8, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Realtime + Auth)
- **Maps**: Leaflet with custom campus satellite imagery
- **QR Scanning**: html5-qrcode
- **Icons**: Lucide React
- **Linting**: Oxlint
- **Build**: Rolldown (via Vite 8)

## Quick Start

### Prerequisites

- Node.js 22+ (via nvm recommended)
- Supabase project

### Installation

```bash
# Clone and install
git clone <repo-url>
cd KRITHOHUNT
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials
```

### Environment Variables

```bash
# Required
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_PASSWORD=your-secure-admin-password

# Optional (development only)
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...
```

### Database Setup

Run the SQL in `schema.sql` in your Supabase SQL Editor to create tables, RLS policies, and seed all 30 clues.

### Development

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Project Structure

```
src/
├── components/
│   ├── primitives/          # Reusable UI primitives (Button, Card, Input, Modal, GameCell, KeypadButton, SafeDigitDisplay)
│   ├── games/               # Game implementations
│   │   ├── SafeCrackerGame.jsx
│   │   └── TowerOfHanoiGame.jsx
│   ├── StartScreen.jsx      # Team registration (mobile-first)
│   ├── PlayScreen.jsx       # Main game container + QR scanner
│   ├── ScanScreen.jsx       # QR verification endpoint
│   ├── AdminDashboard.jsx   # Organizer panel (desktop-first)
│   ├── GameRenderer.jsx     # Lazy-loaded game router
│   ├── SudokuGame.jsx
│   ├── ConnectDotsGame.jsx
│   └── CampusGeoguessrGame.jsx
├── index.css                # Design tokens (@theme) + base styles
├── App.jsx                  # Client-side router
├── main.jsx                 # Entry point
└── supabaseClient.js        # Supabase client init
```

## Design System

All styling uses CSS custom properties defined in `src/index.css` via Tailwind v4's `@theme` directive:

- **Surfaces**: `--surface-0` through `--surface-3`
- **Text**: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse`
- **Accents**: `--accent-red`, `--accent-blue`, `--accent-green`, `--accent-yellow`, `--accent-purple`, `--accent-orange`, `--accent-indigo`
- **Feedback**: `--feedback-success`, `--feedback-warning`, `--feedback-error`
- **Spacing/Radii/Transitions**: Consistent scale tokens

Primitive components in `src/components/primitives/` consume these tokens exclusively — no arbitrary color values in components.

## QR Code Format

**Start Desk** (assigns team to color path):
```
/start?color=red|blue|green|yellow|purple|orange
```

**Location Verification** (unlocks game at physical location):
```
/scan?color=red|blue|green|yellow|purple|orange&stage=1|2|3|4|5
```

## Admin Dashboard

Access at `/admin` with password from `VITE_ADMIN_PASSWORD`.

Features:
- Real-time team table with search/filter
- Sort: Finished (fastest first) → Ready for Jigsaw (earliest start) → Playing (clues desc, penalties asc)
- Mark Finished (records finish_time)
- Delete Team
- Printable QR Sheets (6 start + 30 location QRs)
- Mobile: collapsible sidebar with hamburger menu

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Add environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_PASSWORD`

### Netlify

```bash
# Build
npm run build

# Deploy dist/ folder via Netlify CLI or dashboard
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 4173
CMD ["npm", "run", "preview"]
```

## Security Notes

- **No hardcoded secrets** — all config via environment variables
- **Admin auth** — sessionStorage only, verify server-side for production
- **XSS prevention** — team names sanitized before render
- **QR validation** — origin + color + stage validated client-side; server-side enforcement via RPC
- **RLS policies** — teams table readable; clues table protected; all mutations via SECURITY DEFINER functions

## License

MIT — Built for KRITHOHUNT event.
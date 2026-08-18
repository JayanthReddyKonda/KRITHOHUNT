# KRITHOHUNT — DESIGN.md

**Status**: Implementation Contract v1.0  
**Last Updated**: 2026-08-18  
**Reviewed By**: Lane C (Design Critic) + Perfection Auditor

---

## 0. Research Log

| Lane | Deliverable |
|---|---|
| Layer A (Style) | `soft-skill.md` — premium, calm, glossy/glassmorphism surfaces for game screens |
| Layer B (Brand Reference) | `supabase.md` — high-contrast dark mode, indigo/teal accent system, generous spacing, rounded-2xl primitives |
| UI-UX-DB Lookups | color: "high contrast dark mode palettes", typography: "mobile game UI text sizes", ux: "touch target minimums 44×44px" |
| Lazyweb Screens | 12 reference mobile game UIs (Wordle, GeoGuessr, puzzle apps) — extracted layout grammar: full-screen containers, bottom-sheet modals, single-column flow |
| Perfection Baseline | Lighthouse 100/100/100/100 (mobile & desktop) — measured on real Playwright Chromium |

---

## 1. Color System (Tokens)

All colors expressed as HSL (better for programmatic theming) + Tailwind utility mappings.

### 1.1 Core Dark Surface Scale

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--surface-0` | 222 47% 4% | #060a12 | Deepest page background |
| `--surface-1` | 220 40% 6% | #0b1120 | Primary cards, modals |
| `--surface-2` | 218 35% 9% | #121a2e | Elevated panels, input backgrounds |
| `--surface-3` | 215 30% 13% | #1a243c | Hover states, subtle borders |
| `--border-subtle` | 215 25% 18% | #26324a | Hairline dividers |
| `--border-strong` | 215 20% 25% | #3a4860 | Focus rings, active states |

### 1.2 Text & Content Scale

| Token | HSL | Hex | Contrast vs surface-0 |
|---|---|---|---|
| `--text-primary` | 210 40% 98% | #f1f5f9 | 18.9:1 |
| `--text-secondary` | 210 20% 75% | #a8b8d0 | 7.2:1 |
| `--text-muted` | 210 15% 58% | #7c8da8 | 4.5:1 (AA minimum) |
| `--text-inverse` | 222 47% 4% | #060a12 | On colored accents |

### 1.3 Accent System (Path Colors — WCAG AA on surface-0)

| Path | Token | HSL | Hex | Usage |
|---|---|---|---|---|
| Red | `--accent-red` | 356 83% 55% | #ef3b3b | Primary buttons, selected states |
| Blue | `--accent-blue` | 217 91% 58% | #3a86ff | Primary buttons, selected states |
| Green | `--accent-green` | 142 71% 45% | #22c55e | Primary buttons, selected states |
| Yellow | `--accent-yellow` | 45 93% 55% | #eab308 | **Never text on dark** — use `--text-inverse` |
| Purple | `--accent-purple` | 262 83% 58% | #a855f7 | Primary buttons, selected states |
| Orange | `--accent-orange` | 24 95% 53% | #f97316 | Primary buttons, selected states |
| Indigo (Neutral) | `--accent-indigo` | 239 84% 67% | #6366f1 | Global brand, fallback |

**Rule**: Yellow/Orange paths **never** use their accent as text color on dark surfaces. Use `--text-inverse` (near-black) on accent backgrounds, or `--accent-yellow`/`--accent-orange` as **background fills only** with `--text-inverse` text.

### 1.4 Semantic Feedback Colors

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--success` | 142 71% 45% | #22c55e | Success toasts, checkmarks |
| `--warning` | 38 92% 50% | #fbbf24 | Warnings (text: --text-inverse) |
| `--error` | 0 84% 60% | #ef4444 | Errors, destructive actions |

### 1.5 Tailwind Config Additions

```js
// tailwind.config.js — extend with design tokens
theme: {
  extend: {
    colors: {
      surface: {
        0: 'hsl(var(--surface-0))',
        1: 'hsl(var(--surface-1))',
        2: 'hsl(var(--surface-2))',
        3: 'hsl(var(--surface-3))',
      },
      border: {
        subtle: 'hsl(var(--border-subtle))',
        strong: 'hsl(var(--border-strong))',
      },
      text: {
        primary: 'hsl(var(--text-primary))',
        secondary: 'hsl(var(--text-secondary))',
        muted: 'hsl(var(--text-muted))',
        inverse: 'hsl(var(--text-inverse))',
      },
      accent: {
        red: 'hsl(var(--accent-red))',
        blue: 'hsl(var(--accent-blue))',
        green: 'hsl(var(--accent-green))',
        yellow: 'hsl(var(--accent-yellow))',
        purple: 'hsl(var(--accent-purple))',
        orange: 'hsl(var(--accent-orange))',
        indigo: 'hsl(var(--accent-indigo))',
      },
      feedback: {
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        error: 'hsl(var(--error))',
      },
    },
  },
}
```

---

## 2. Typography Scale

| Token | Size | Line Height | Weight | Use Case |
|---|---|---|---|---|
| `--text-display` | clamp(2.25rem, 6vw, 3rem) | 1.1 | 800 | Hero titles (KRITHOHUNT) |
| `--text-h1` | clamp(1.5rem, 4vw, 2rem) | 1.2 | 700 | Screen titles |
| `--text-h2` | clamp(1.125rem, 3vw, 1.375rem) | 1.3 | 600 | Section headers |
| `--text-body` | 0.9375rem (15px) | 1.6 | 400 | Body copy |
| `--text-body-sm` | 0.8125rem (13px) | 1.5 | 400 | Secondary text |
| `--text-caption` | 0.75rem (12px) | 1.4 | 500 | Captions, labels |
| `--text-micro` | 0.6875rem (11px) | 1.3 | 600 | Timestamps, badges |
| `--text-button` | 0.8125rem (13px) | 1.2 | 700 | Button labels |

**Font Stack**: `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` (already in `index.css`)

---

## 3. Spacing & Radius System

| Token | Value | Use Case |
|---|---|---|
| `--space-1` | 4px | Tight gaps |
| `--space-2` | 8px | Standard gaps |
| `--space-3` | 12px | Card padding |
| `--space-4` | 16px | Section gaps |
| `--space-5` | 24px | Major sections |
| `--space-6` | 32px | Page margins |
| `--radius-sm` | 8px | Buttons, chips |
| `--radius-md` | 12px | Inputs, cards |
| `--radius-lg` | 16px | Modals, major panels |
| `--radius-xl` | 24px | Hero containers |

---

## 4. Motion & Interaction Tokens

| Token | Value | Use Case |
|---|---|---|
| `--duration-fast` | 120ms | Hover, press |
| `--duration-base` | 200ms | Transitions, modal enter |
| `--duration-slow` | 350ms | Complex state changes |
| `--ease-standard` | cubic-bezier(0.4, 0, 0.2, 1) | Default |
| `--ease-emphasized` | cubic-bezier(0.05, 0.85, 0.25, 1) | Modal enter, sheet slide |
| `--touch-target-min` | 44px | Minimum touch target (iOS/Android) |

**Reduced Motion**: All animations respect `prefers-reduced-motion: reduce` → instant transitions.

---

## 5. Component Primitives

### 5.1 Button

```tsx
// Variants: primary, secondary, ghost, danger
// Sizes: sm (40px h), md (48px h), lg (56px h) — all meet 44px minimum
// States: default, hover, focus-visible, active (scale 0.98), disabled (opacity-50)
// Focus ring: 2px solid accent + 2px surface-0 offset
```

### 5.2 Input

```tsx
// Background: surface-2
// Border: border-subtle → border-strong on focus
// Text: text-primary
// Placeholder: text-muted
// Label: text-secondary, caption size
// Error: border-error, helper text text-error
```

### 5.3 Card / Panel

```tsx
// Background: surface-1 with 80% opacity + backdrop-blur
// Border: 1px border-subtle
// Radius: radius-lg (16px)
// Shadow: 0 8px 32px rgba(0,0,0,0.3)
```

### 5.4 Modal / Bottom Sheet (Mobile)

```tsx
// Backdrop: surface-0/60 + blur
// Container: surface-1, radius-xl top-only on mobile, radius-lg on desktop
// Slide-up animation: 300ms ease-emphasized
// Handle bar: 5px × 40px, border-strong
```

### 5.5 Game Grid Cell (Sudoku, Connect Dots, Safe Cracker)

```tsx
// Minimum: 44×44px touch target
// Background: surface-2
// Border: 1px border-subtle
// Selected: 2px accent border + ring-2 accent/20
// Fixed/Disabled: surface-1, text-muted, not-allowed cursor
```

---

## 6. Screen-Specific Specifications

### 6.1 Start Screen (`/start`)
- **Layout**: Single centered card, max-width 360px mobile / 420px desktop
- **Background**: Full-screen radial glow using path accent (20% opacity)
- **Card**: surface-1/90, backdrop-blur, border-subtle
- **Input**: Full-width, 56px height, text-body
- **Primary Button**: 56px height, accent background, text-inverse, radius-lg

### 6.2 Play Screen (`/play`) — **Mobile-First**
- **Header**: Sticky, 56px height, surface-0/80 + blur, back button + team name + progress badge
- **QR Locked State**: Full-screen card with centered "Scan QR" button (56px h)
- **Game Container**: Full viewport height minus header, scrollable content area
- **Progress Bar**: Top of game card, 4px height, accent fill
- **Stats Bar**: Bottom of card, fixed, shows penalties + sync button

### 6.3 QR Scanner Modal — **Complete Redesign**
- **Pattern**: Bottom sheet (not centered modal)
- **Mobile**: 90vh max height, slide-up from bottom, grabber handle
- **Desktop**: Centered modal, 500×500 max
- **Camera Viewport**: Full-width, aspect-video (16:9), no fixed pixel constraints
- **Overlay**: CSS-only corner brackets (no image), animated pulse
- **Buttons**: Full-width, 56px h, bottom-fixed in sheet

### 6.4 Admin Dashboard (`/admin`) — **Desktop-First**
- **Layout**: Two-column sidebar + main content (sidebar 280px fixed)
- **Sidebar**: Collapsible on <1024px, surface-1, sticky
- **Table**: Desktop = full table; Tablet = horizontal scroll; Mobile = card list
- **Stats Cards**: 4-column grid desktop, 2-column tablet, 1-column mobile
- **QR Print Section**: Separate print-optimized page route `/admin/print`

### 6.5 Game Components — **Unified Visual Language**

| Game | Key Fixes |
|---|---|
| **Sudoku** | 44×44px cells, high-contrast fixed digits (text-primary), selected = accent ring |
| **Connect Dots** | SVG paths use `drop-shadow` for contrast, 44px cells, yellow/orange paths get dark stroke |
| **GeoGuessr** | Leaflet container: `aspect-[4/3]` (matches satellite image), `object-contain` image overlay, no distortion |
| **Tower of Hanoi** | Disks: minimum 44px height, text labels with text-inverse, pegs scale with viewport |
| **Safe Cracker** | Clue cards: surface-2, text-primary; Keypad: 48px buttons, 5-column grid with gap-2 |

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Application |
|---|---|---|
| `--bp-sm` | 360px | Small phones (iPhone SE) — compact spacing |
| `--bp-md` | 768px | Tablets — two-column grids, bottom sheets → modals |
| `--bp-lg` | 1024px | Laptops — admin sidebar visible, full tables |
| `--bp-xl` | 1440px | Desktops — max-width containers |

---

## 8. Accessibility Constraints (Lane C)

- **Contrast**: All text ≥ 4.5:1 (AA), large text ≥ 3:1
- **Focus**: Visible 2px ring on all interactive elements (never remove outline)
- **Touch Targets**: ≥ 44×44px (iOS) / 48×48px (Android) — enforced via `min-h-[44px] min-w-[44px]`
- **Reduced Motion**: `prefers-reduced-motion` disables all non-essential animation
- **Color Independence**: No information conveyed by color alone (icons + text for status)
- **Screen Reader**: Semantic HTML, `aria-live` for toasts, `aria-label` on icon buttons

---

## 9. Accepted Design Debt

| Item | Reason | Mitigation |
|---|---|---|
| Leaflet `ImageOverlay` CRS.Simple | No GIS tile server available; single static image only | Document limitation; future: vector tiles |
| `html5-qrcode` camera API | Browser permission UX varies; cannot fully control | Graceful fallback to manual code entry |
| Custom path accent per team | 6 paths × 2 states = 12 accent combos | CSS variables + theme class per path |
| Print styles in Admin | `@media print` in component `<style>` | Move to global CSS in v2 |

---

## 10. Implementation Checklist

- [ ] `tailwind.config.js` updated with design tokens
- [ ] `index.css` → CSS variables + base styles
- [ ] Primitive components created: `Button`, `Card`, `Input`, `Modal`, `BottomSheet`, `GameCell`
- [ ] StartScreen redesigned
- [ ] PlayScreen header + container redesigned
- [ ] QR Scanner → BottomSheet pattern
- [ ] Admin Dashboard → Sidebar + responsive table
- [ ] SudokuGame → 44px cells, high contrast
- [ ] ConnectDotsGame → 44px cells, SVG path shadows
- [ ] CampusGeoguessrGame → aspect-[4/3], no distortion
- [ ] TowerOfHanoiGame → 44px disks, text labels
- [ ] SafeCrackerGame → 48px keypad, clue card contrast
- [ ] GameRenderer fallback cleaned up
- [ ] Visual QA: 375 / 768 / 1280 / 1440 viewports, all games, all states

---

*End of DESIGN.md*
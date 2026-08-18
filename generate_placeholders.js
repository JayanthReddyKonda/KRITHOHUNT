import fs from 'fs';
import path from 'path';

// 1. Campus Satellite SVG Map (1000x1000 viewbox)
const campusSatelliteSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <defs>
    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1e293b" stroke-width="1" opacity="0.4"/>
    </pattern>
    <linearGradient id="grass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="100%" stop-color="#022c22" />
    </linearGradient>
    <linearGradient id="water" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
  </defs>

  <!-- Base Terrain -->
  <rect width="1000" height="1000" fill="url(#grass)" />
  <rect width="1000" height="1000" fill="url(#grid)" />

  <!-- Roads & Pathways -->
  <path d="M 0 500 Q 250 480 500 500 T 1000 500" stroke="#334155" stroke-width="36" fill="none" stroke-linecap="round"/>
  <path d="M 500 0 Q 520 250 500 500 T 500 1000" stroke="#334155" stroke-width="36" fill="none" stroke-linecap="round"/>
  <circle cx="500" cy="500" r="80" fill="#1e293b" stroke="#475569" stroke-width="6"/>

  <!-- Landmark 1: Central Library (x=250, y=250 -> norm x=0.25, y=0.25) -->
  <g id="library-zone">
    <rect x="150" y="150" width="200" height="200" rx="16" fill="#1e1b4b" stroke="#6366f1" stroke-width="6"/>
    <rect x="180" y="180" width="140" height="140" rx="8" fill="#312e81" stroke="#818cf8" stroke-width="3"/>
    <text x="250" y="255" fill="#e0e7ff" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">CENTRAL</text>
    <text x="250" y="285" fill="#a5b4fc" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">LIBRARY</text>
  </g>

  <!-- Landmark 2: Student Canteen (x=750, y=250 -> norm x=0.75, y=0.25) -->
  <g id="canteen-zone">
    <rect x="650" y="150" width="200" height="200" rx="100" fill="#701a75" stroke="#d946ef" stroke-width="6"/>
    <circle cx="750" cy="250" r="70" fill="#86198f" stroke="#f0abfc" stroke-width="3"/>
    <text x="750" y="245" fill="#fae8ff" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">CAMPUS</text>
    <text x="750" y="275" fill="#f5d0fe" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">CANTEEN</text>
  </g>

  <!-- Landmark 3: Grand Auditorium (x=250, y=750 -> norm x=0.25, y=0.75) -->
  <g id="auditorium-zone">
    <polygon points="250,630 350,850 150,850" fill="#7c2d12" stroke="#f97316" stroke-width="6"/>
    <circle cx="250" cy="760" r="45" fill="#9a3412" stroke="#fdba74" stroke-width="3"/>
    <text x="250" y="755" fill="#ffedd5" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">GRAND</text>
    <text x="250" y="780" fill="#fed7aa" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">AUDITORIUM</text>
  </g>

  <!-- Landmark 4: Main Entrance Gate (x=500, y=100 -> norm x=0.50, y=0.10) -->
  <g id="maingate-zone">
    <rect x="380" y="40" width="240" height="120" rx="12" fill="#065f46" stroke="#10b981" stroke-width="6"/>
    <path d="M 400 100 L 600 100" stroke="#34d399" stroke-width="8" stroke-dasharray="12 8"/>
    <text x="500" y="85" fill="#ecfdf5" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">MAIN GATE</text>
  </g>

  <!-- Landmark 5: Sports Ground (x=750, y=750 -> norm x=0.75, y=0.75) -->
  <g id="sportsground-zone">
    <rect x="630" y="630" width="240" height="240" rx="50" fill="#14532d" stroke="#22c55e" stroke-width="6"/>
    <ellipse cx="750" cy="750" rx="90" ry="70" fill="none" stroke="#86efac" stroke-width="4" stroke-dasharray="8 6"/>
    <text x="750" y="745" fill="#f0fdf4" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">SPORTS</text>
    <text x="750" y="775" fill="#bbf7d0" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">GROUND</text>
  </g>

  <!-- Reflecting Fountain Pond -->
  <circle cx="500" cy="500" r="50" fill="url(#water)" stroke="#38bdf8" stroke-width="4"/>
</svg>`;

const createPhotoSvg = (title, subtitle, bgColor, accentColor, iconShape) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="${bgColor}" />
  <rect x="20" y="20" width="760" height="560" rx="16" fill="none" stroke="${accentColor}" stroke-width="6" opacity="0.4"/>
  
  <g transform="translate(400, 260)">
    ${iconShape}
  </g>

  <text x="400" y="440" fill="#ffffff" font-family="sans-serif" font-size="36" font-weight="800" text-anchor="middle" letter-spacing="2">${title}</text>
  <text x="400" y="485" fill="${accentColor}" font-family="sans-serif" font-size="22" font-weight="600" text-anchor="middle" letter-spacing="1">${subtitle}</text>
  <text x="400" y="540" fill="#94a3b8" font-family="sans-serif" font-size="14" text-anchor="middle">KRITHOHUNT LOCATION PHOTOGRAPH</text>
</svg>`;

// Generate Location Photos
const photos = {
  'library.svg': createPhotoSvg(
    'CENTRAL LIBRARY ENTRANCE',
    'ARCHITECTURAL FAÇADE & STUDY STEPS',
    '#0f172a',
    '#818cf8',
    `<rect x="-70" y="-70" width="140" height="140" rx="12" fill="#1e1b4b" stroke="#6366f1" stroke-width="6"/>
     <path d="M-40 20 L0 -40 L40 20 Z" fill="#818cf8"/>`
  ),
  'canteen.svg': createPhotoSvg(
    'STUDENT CANTEEN PATIO',
    'OUTDOOR CAFETERIA SEATING & PERGOLA',
    '#2e1065',
    '#f0abfc',
    `<circle cx="0" cy="0" r="70" fill="#701a75" stroke="#d946ef" stroke-width="6"/>
     <circle cx="0" cy="0" r="35" fill="#f0abfc"/>`
  ),
  'auditorium.svg': createPhotoSvg(
    'GRAND AUDITORIUM FOYER',
    'MAIN STAGE ENTRANCE & GLASS PORTICO',
    '#451a03',
    '#fdba74',
    `<polygon points="0,-70 70,60 -70,60" fill="#7c2d12" stroke="#f97316" stroke-width="6"/>`
  ),
  'main-gate.svg': createPhotoSvg(
    'CAMPUS MAIN ENTRANCE GATE',
    'NORTH ARCH & GUARDHOUSE CHECKPOINT',
    '#022c22',
    '#34d399',
    `<rect x="-80" y="-40" width="160" height="80" rx="8" fill="#065f46" stroke="#10b981" stroke-width="6"/>`
  ),
  'sports-ground.svg': createPhotoSvg(
    'SPORTS COMPLEX TRACK',
    'SYNTHETIC ATHLETIC TRACK & BLEACHERS',
    '#052e16',
    '#86efac',
    `<ellipse cx="0" cy="0" rx="80" ry="50" fill="#14532d" stroke="#22c55e" stroke-width="6"/>`
  )
};

// Write files
fs.mkdirSync(path.join(process.cwd(), 'public/geo/locations'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), 'public/geo/campus-satellite.svg'), campusSatelliteSvg);

Object.entries(photos).forEach(([filename, content]) => {
  fs.writeFileSync(path.join(process.cwd(), 'public/geo/locations', filename), content);
});

console.log('Generated placeholder satellite map and location photo SVGs successfully!');


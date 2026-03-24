# 🏀 Giddey

**The daily basketball draft puzzle.** Draft 9 players, arrange them on a court-shaped grid, and build the highest-scoring team through talent and chemistry.

Inspired by **2K MyTeam** card tiers and the formation-puzzle genre (Griddy for football).

<p align="center">
  <img src="public/logo.png" alt="Giddey logo" width="120" />
</p>

---

## How It Works

Each game is a **9-round draft**. Every round you're dealt 3 random player cards and must pick one to place on your grid. Once placed, there's no take-backs — but you can rearrange positions at any time by dragging cards around.

Your final score is **Talent + Chemistry** (max 279).

### Talent (max 135)

Every card belongs to a **tier** based on its Overall Rating. Higher tiers = more talent points:

| Tier | OVR | Talent |
|------|-----|--------|
| Dark Matter | 99–100 | +15 |
| Galaxy Opal | 97–98 | +13 |
| Pink Diamond | 95–96 | +11 |
| Diamond | 92–94 | +9 |
| Amethyst | 90–91 | +7 |
| Ruby | 87–89 | +5 |
| Sapphire | 84–86 | +4 |
| Emerald | 80–83 | +2 |
| Gold | 76–79 | +1 |

Earlier draft rounds have better odds of pulling high-tier cards.

### Chemistry (max 144)

Adjacent players on the grid earn **line chemistry** based on shared traits:

- **Green Line (+3)** — Same team, or same division + same draft year
- **Yellow Line (+1)** — Same division or same draft year
- **Red Line (0)** — No shared traits

Each player also earns **dot chemistry** based on their total connected line chem:

- **Green Dot (+11)** — 4+ accumulated line chem
- **Yellow Dot (+6)** — 2–3 line chem
- **Red Dot (0)** — 0–1 line chem

### The Grid

9 positions arranged in a diamond formation with **15 adjacency connections**:

```
        [SG]    [PF]
  [UTIL] [PG]  [PG] [UTIL]
  [SF]              [SG]
           [C]
```

- **Center (C)** connects to 4 neighbors — the most important slot
- **PG** slots connect to 4 neighbors each but not to each other
- **UTIL** slots accept any position
- Cards can be placed at their primary or secondary position

---

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **TypeScript 5.9**
- **Tailwind CSS 4**
- No database — the full 235-player roster lives in a JSON file sourced from 2K ratings

---

## Getting Started

```bash
cd giddey-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |

---

## Project Structure

```
giddey-app/
├── public/
│   ├── logo.png              # App icon / OG image
│   ├── logo.svg              # Vector version
│   ├── hoodie-carmelo.png    # Custom hero card art
│   └── manifest.json         # PWA manifest
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout + SEO metadata
│   │   ├── page.tsx          # Home / landing page
│   │   ├── draft/            # Main game page
│   │   ├── how-to-play/      # Rules & guide
│   │   ├── api/players/      # Player data API route
│   │   ├── sitemap.ts        # Auto-generated sitemap
│   │   └── robots.ts         # Crawler rules
│   ├── components/
│   │   ├── Grid.tsx          # Court grid with drag-and-drop
│   │   ├── PlayerCard.tsx    # 2K-style card component
│   │   ├── DraftOptions.tsx  # Round pick selection
│   │   ├── ResultsScreen.tsx # Final score + optimal lineup
│   │   ├── MiniGridDiagram.tsx # SVG formation diagram
│   │   ├── Header.tsx        # Score bar header
│   │   └── ScoreDisplay.tsx  # Score breakdown display
│   ├── data/
│   │   └── nba-players.json  # 235 NBA players from 2K ratings
│   └── lib/
│       ├── types.ts          # Grid layout, tiers, adjacencies, draft odds
│       ├── players.ts        # Player loading, OVR overrides, custom cards
│       ├── teams.ts          # 30 NBA teams with divisions & conferences
│       ├── draft.ts          # Draft logic (tier rolls, option generation)
│       ├── scoring.ts        # Talent + chemistry calculation engine
│       ├── images.ts         # Player headshot & team logo URL resolution
│       ├── player-loader.ts  # Dynamic player loading for client
│       └── example-cards.ts  # Shared example data for How to Play
```

---

## Custom Cards & Overrides

### OVR Overrides

Select players are boosted above their 2K rating to populate the Dark Matter and Galaxy Opal tiers:

| Player | Base OVR | Override |
|--------|----------|----------|
| Shai Gilgeous-Alexander | 98 | **100** (Dark Matter) |
| Nikola Jokic | 98 | **100** (Dark Matter) |
| Victor Wembanyama | 96 | **100** (Dark Matter) |
| Stephen Curry | 95 | **100** (Dark Matter) |
| LeBron James | 92 | **100** (Dark Matter) |
| Kevin Durant | 93 | **100** (Dark Matter) |
| Luka Doncic | 97 | **100** (Dark Matter) |
| Anthony Edwards | 96 | **98** (Galaxy Opal) |
| Cade Cunningham | 88 | **97** (Galaxy Opal) |

### Hero Cards

Special edition cards with unique art and the `badge` label on the card:

| Card | Player | Team | Tier | Badge |
|------|--------|------|------|-------|
| Hoodie Melo | Carmelo Anthony | NYK | Dark Matter (100) | HOODIE |

Hero cards are linked to their base player via `playerId` so both versions can't appear in the same draft.

---

## Key Design Decisions

- **No backend needed** — everything runs client-side. Player data is bundled in the build and loaded dynamically.
- **Responsive grid** — the court formation scales dynamically based on viewport width with no hardcoded breakpoints. Cards, gaps, dots, and labels all scale proportionally.
- **Drag-and-drop + tap** — cards can be placed and rearranged via drag-and-drop or tap-to-select on mobile.
- **Optimal lineup solver** — after submitting, a brute-force solver finds the best possible arrangement of your 9 drafted cards and shows you how close you got.
- **2K MyTeam aesthetic** — card tiers use gradient backgrounds, gem-shaped OVR badges, star ratings, headshot images from 2K, and animated shimmer effects for top tiers.

---

## Adding Players

1. Update `src/data/nba-players.json` with new entries in the format:
   ```json
   {
     "first_name": "...",
     "last_name": "...",
     "position": "PG / SG",
     "rating": 95,
     "team_name": "Oklahoma City Thunder",
     "team_division": "Northwest",
     "draft_year": 2018,
     "image": "...",
     "team_logo": "..."
   }
   ```
2. For OVR overrides, add to the `OVR_OVERRIDES` map in `src/lib/players.ts`
3. For custom hero cards, add to the `CUSTOM_CARDS` array and add an image override in `src/lib/images.ts`

---

## License

ISC

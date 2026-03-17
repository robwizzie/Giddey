# Giddey - Basketball Draft Puzzle Game (Griddy Clone for Basketball)

## Deep Dive Research: How Griddy Works

### What is Griddy?
Griddy is a daily fantasy football puzzle game where you draft player cards to build the highest-graded lineup. It's like Wordle meets fantasy football — quick 2-3 minute sessions, free to play, no ads, no betting. Over 5M+ games played, 48K+ users.

---

## 1. CORE GAMEPLAY LOOP

### The Draft
- **9 rounds** of drafting
- Each round: pick **1 card from 3 randomly generated options**
- Cards are position-locked (QB, RB, WR, TE in football)
- Once you pick a card, you **cannot undo the pick**
- But you **CAN rearrange** card positions on your grid at any time during the draft
- Drag and drop cards into position slots

### The Grid Layout (3x3)
Griddy uses a **3x3 grid** with specific position slots. In football:

```
┌─────────┬─────────┬─────────┐
│   RB    │   QB    │   WR    │
├─────────┼─────────┼─────────┤
│  FLEX   │   QB    │  FLEX   │
├─────────┼─────────┼─────────┤
│   RB    │   TE    │   WR    │
└─────────┴─────────┴─────────┘
```

- **2 QB slots** (center column, top and middle)
- **2 RB slots** (left column, top and bottom)
- **2 WR slots** (right column, top and bottom)
- **1 TE slot** (center bottom — the most strategic position)
- **2 FLEX slots** (can be RB, WR, or TE)

**Key insight:** The TE position is the most important — it connects both sides of the grid and multiple rows, acting as the "bridge" for chemistry.

### Chemistry Connections
Chemistry links form between **adjacent cells** on the grid. Players connect via:

| Connection Type | Points |
|----------------|--------|
| Same Division  | 1 point per connection |
| Same Draft Class (Year) | 1 point per connection |
| Same Team | 2 points per connection |

**Connections stack!** Two teammates from the same draft class = 3 points (2 team + 1 draft class).

### Talent Scoring (Card Tiers)

| Tier | Talent Points | Rarity |
|------|--------------|--------|
| Bronze | 3 | Common |
| Silver | 5 | Uncommon |
| Gold | 8 | Rare |
| Platinum | 11 | Very Rare |
| Hero | 15 | Extremely Rare |

- Max theoretical talent = 135 (all 9 Hero cards, virtually impossible)
- Higher-tier cards are more likely in early rounds
- Some top players have two versions (Hero + Platinum/Gold)

### Final Score
**Total Score = Talent Points + Chemistry Points**

Chemistry often matters MORE than talent for cracking the leaderboard.

---

## 2. GAME MODES

### Solo Mode
- Compete against yourself
- 3 free drafts per day (4th and 5th cost tokens)
- Results affect your **GLO rating**
- GLO = your overall skill rating/résumé
- Scoring above the median (50th percentile) raises GLO
- Scoring below the median lowers GLO
- Great for practice

### Versus Mode
- 1v1 head-to-head against friends or strangers
- Create challenges with custom settings (round length, card pool)
- No daily limit on versus games
- GLO does NOT change in versus — just win/lose
- Share challenge links to invite opponents

### Griddy Leagues
- Create leagues with up to 32 friends
- Full standings, stats, season history
- Draft head-to-head within the league
- Trophies and season tracking

---

## 3. APP SCREENS & FEATURES

### Home Screen
- Daily draft prompt
- Remaining drafts counter (3 free/day)
- Quick access to Solo, Versus, and League modes
- Dark-themed UI

### Draft Screen
- 3x3 grid displayed with position labels
- 3 card options shown each round (pick one)
- Cards show: player name, team, position, tier color/badge
- Real-time score updating as you place cards
- Chemistry lines/highlights between connected players
- Drag-and-drop to rearrange grid
- Round counter (1-9)

### Results Screen
- Final score breakdown (Talent + Chemistry = Total)
- Grid displayed with all 9 players
- Chemistry connections highlighted
- Percentile ranking (where you finished vs. other players)
- Share button for social media

### Leaderboard Screen
- Global and Friends leaderboards
- Filter by: Today, This Week, All Time
- Rankings by: GLO, VS Wins, VS Streak, Top Draft Grade
- Badges and achievements unlocked

### Profile / Stats Screen
- GLO rating prominently displayed
- Stats: current streak, all-time high, total drafts, avg talent, avg chemistry, best finish
- Historical draft data
- Referral code/invite link
- Badges/achievements collection

---

## 4. BASKETBALL ADAPTATION: "GIDDEY"

### Position Mapping (Football → Basketball)

Football has: QB, RB, WR, TE, FLEX
Basketball has: PG, SG, SF, PF, C, UTIL(Flex)

**Proposed 3x3 Basketball Grid:**

```
┌─────────┬─────────┬─────────┐
│   SG    │   PG    │   SF    │
├─────────┼─────────┼─────────┤
│  UTIL   │   PG    │  UTIL   │
├─────────┼─────────┼─────────┤
│   SG    │    C    │   PF    │
└─────────┴─────────┴─────────┘
```

**OR (Alternative - more balanced):**

```
┌─────────┬─────────┬─────────┐
│   PG    │   SG    │   SF    │
├─────────┼─────────┼─────────┤
│  UTIL   │    C    │  UTIL   │
├─────────┼─────────┼─────────┤
│   PG    │   PF    │   SF    │
└─────────┴─────────┴─────────┘
```

**Key consideration:** The **Center (C)** position should serve as the "bridge" position (like TE in Griddy) — placed at the center of the grid where it connects to the most adjacent cells.

**Recommended Grid (C as bridge, mimicking TE importance):**

```
┌─────────┬─────────┬─────────┐
│   PG    │   SF    │   SG    │
├─────────┼─────────┼─────────┤
│  UTIL   │    C    │  UTIL   │
├─────────┼─────────┼─────────┤
│   PG    │   PF    │   SG    │
└─────────┴─────────┴─────────┘
```

- **C (Center)** in the true center — connects to all 4 adjacent cells (max chemistry potential)
- **2 PG slots** (left column)
- **2 SG slots** (right column)
- **1 SF slot** (top center)
- **1 PF slot** (bottom center)
- **2 UTIL slots** (can be any position)

### Chemistry Categories (Basketball Equivalent)

| Football | Basketball Equivalent | Points |
|----------|----------------------|--------|
| Same Team | Same Team | 2 points |
| Same Division | Same Division (e.g., Atlantic, Pacific, Central, etc.) | 1 point |
| Same Draft Class | Same Draft Class (Year) | 1 point |

**NBA has 6 divisions:**
- **Eastern Conference:** Atlantic, Central, Southeast
- **Western Conference:** Northwest, Pacific, Southwest

This maps perfectly to Griddy's conference/division system.

### Card Tier System (Basketball)

| Tier | Points | Example Players |
|------|--------|----------------|
| Bronze | 3 | Role players, bench players |
| Silver | 5 | Solid starters |
| Gold | 8 | All-Star caliber |
| Platinum | 11 | All-NBA players |
| Hero | 15 | MVP-level / Legends |

---

## 5. DATA SOURCE: RECOMMENDED API

### Primary: **BallDontLie API** (https://balldontlie.io)
**Why this is the best choice:**

- **Free tier available** with generous rate limits
- **Player data includes:** first_name, last_name, position, height, weight, jersey_number, college, country, **draft_year**, draft_round, draft_number
- **Team data includes:** id, **conference**, **division**, city, name, full_name, abbreviation
- **Official TypeScript SDK:** `@balldontlie/sdk` (npm install)
- Covers decades of NBA history
- REST API — easy to integrate with any web framework
- Active and maintained

**Key fields we need for chemistry:**
- `player.team` → Same Team chemistry (2 pts)
- `player.team.division` → Same Division chemistry (1 pt)
- `player.draft_year` → Same Draft Class chemistry (1 pt)

### Alternative: **nba_api** (Python, github.com/swar/nba_api)
- Fully free, pulls from NBA.com
- More comprehensive (253+ endpoints)
- Python-only — would need a backend or data export
- Good for building an initial player database/seed data

### Data Strategy
1. Use **BallDontLie API** for real-time player/team lookups
2. Pre-seed a local database with player cards (tier assignments based on career stats, All-Star selections, awards)
3. Tier assignment algorithm could consider: career PPG, All-Star appearances, All-NBA selections, MVP votes, championships

---

## 6. TECH STACK RECOMMENDATION (Website)

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | **Next.js 14+ (App Router)** | SSR, fast, great DX |
| Styling | **Tailwind CSS** | Rapid UI development, dark theme easy |
| State | **Zustand** or React Context | Lightweight game state management |
| Backend | **Next.js API Routes** | Keep it simple, same repo |
| Database | **Supabase (PostgreSQL)** | Free tier, auth built-in, real-time |
| Auth | **Supabase Auth** | Email, Google, social login |
| API | **BallDontLie SDK** | Player/team data |
| Hosting | **Vercel** | Free tier, perfect for Next.js |
| Animations | **Framer Motion** | Card animations, drag-and-drop |

### Key UI Design Principles (matching Griddy's feel)
- **Dark theme** (deep navy/black background)
- **Card-based design** with tier-colored borders (bronze shimmer, silver shine, gold glow, platinum sparkle, hero rainbow/special effect)
- **Clean, minimal layout** — focus on the grid
- **Smooth animations** — card flips, chemistry line animations, score counter
- **Mobile-first responsive** — but optimized for web
- **Sports aesthetic** — basketball textures, court-inspired elements

---

## 7. FEATURE PRIORITY (MVP → Full)

### MVP (Phase 1)
- [ ] Player card database with tier assignments
- [ ] 3x3 grid with basketball positions
- [ ] 9-round draft mechanic (pick 1 of 3)
- [ ] Talent + Chemistry scoring
- [ ] Drag-and-drop grid rearrangement
- [ ] Results screen with score breakdown
- [ ] Daily puzzle (new cards each day)

### Phase 2
- [ ] User accounts and authentication
- [ ] GLO rating system
- [ ] Leaderboards (daily, weekly, all-time)
- [ ] Stats tracking and history
- [ ] Social sharing

### Phase 3
- [ ] 1v1 Versus mode
- [ ] Leagues (up to 32 players)
- [ ] Badges and achievements
- [ ] Referral system
- [ ] Push notifications

---

## 8. EXISTING BASKETBALL GRID GAMES (Competitors)

These are **trivia-style** grid games (guess which player played for both teams), NOT draft puzzle games like Griddy:

- **HoopGrids** (hoopgrids.com) — Daily NBA trivia grid
- **Immaculate Grid: Basketball** (sports-reference.com) — Daily trivia grid
- **NBA Grid** (nbagr.id) — Daily player guessing

**Key differentiator:** Giddey would be the FIRST basketball **draft puzzle** game (like Griddy), not a trivia game. This is a blue ocean — no direct competition exists for a basketball version of Griddy's draft+chemistry mechanic.

---

## Sources
- [Griddy Official Website](https://griddy.cc/)
- [Griddy on App Store](https://apps.apple.com/us/app/griddy-football-puzzles/id6636555692)
- [Griddy on Google Play](https://play.google.com/store/apps/details?id=com.griddy&hl=en_US)
- [FantasyPros: Griddy Strategy Guide](https://www.fantasypros.com/2024/12/griddy-the-strategy-behind-fantasy-football-puzzles/)
- [FantasyPros: Griddy Overview](https://www.fantasypros.com/2024/12/griddy-fantasy-football-puzzles-sports-strategy-game/)
- [How Griddy Turned Fantasy Football Into a Year-Round Game](https://news.bettingstartups.com/p/how-griddy-turned-fantasy-football-into-a-year-round-game)
- [BallDontLie API](https://www.balldontlie.io/)
- [nba_api (GitHub)](https://github.com/swar/nba_api)
- [Basketball-Reference](https://www.basketball-reference.com/)

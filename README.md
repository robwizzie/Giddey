<p align="center">
  <img src="giddey-app/public/logo.png" alt="Giddey" width="100" />
</p>

<h1 align="center">Giddey</h1>

<p align="center">
  <strong>A daily basketball draft puzzle game.</strong><br/>
  Draft 9 players. Build chemistry. Score big.
</p>

<p align="center">
  <a href="https://playgiddey.com">Play Now</a>
</p>

---

## What is Giddey?

Giddey is a browser-based puzzle game inspired by **2K MyTeam** and formation puzzles like Griddy. Each game is a 9-round draft where you're dealt 3 random NBA player cards per round and must pick one to place on a court-shaped grid.

The catch: you can't undo a pick, and your score depends on both the **talent** of the players you draft and the **chemistry** between them on the grid.

Your goal is to maximize your total score out of **279**.

## How Scoring Works

**Talent** — Higher-rated cards earn more points. Cards range from Gold (76 OVR, +1 pt) to Dark Matter (100 OVR, +15 pts). Max talent across 9 cards is 135.

**Chemistry** — Adjacent players on the grid earn chemistry bonuses when they share a **team**, **division**, or **draft year**. Strong connections light up green lines and green dots for big bonus points. Max chemistry is 144.

## The Grid

Your 9 players are arranged in a diamond formation with 15 connections between them:

```
        [SG]    [PF]
  [UTIL] [PG]  [PG] [UTIL]
  [SF]              [SG]
           [C]
```

The **Center** slot is the most connected position on the board (4 neighbors), making it the most important pick. **UTIL** slots accept any position. You can drag cards around to rearrange at any time.

## Features

- **9 card tiers** from Gold to Dark Matter, each with unique 2K-style card art, shimmer effects, and star ratings
- **235+ NBA players** with real headshots, teams, divisions, and draft years
- **Custom hero cards** like Hoodie Melo (Dark Matter, 100 OVR, Knicks)
- **Drag-and-drop** card placement and rearranging (works on mobile too)
- **Optimal lineup solver** that shows the best possible arrangement after you submit
- **Draft odds** that shift each round — early picks have better chances at elite tiers
- **PWA ready** — add to your home screen for a native app feel

## Versus Mode — 2K27 Draft Night

A head-to-head mode at [`/versus`](https://playgiddey.com/versus) for two people building teams to play against each other in NBA 2K27. Ratings are the real 2K27 launch overalls: 209 current players and 136 All-Time legends.

**Drafting**
- **Pools:**
  - Modern
  - All-Time
  - Both
  - **Era Wars**: one coach drafts today's players and the other drafts legends, with tiers matched by OVR so it stays fair.
- **Draft styles:**
  - **Pack Snake**
  - **I Cut, You Choose**
  - **Franchise Wheel**
  - **Auction**: a salary-cap draft where you nominate anyone in the pool and bid on them.
  - **Auction Block**: players come up on their own, stars first, with the next 3 lots in view. You bid or pass, and per-tier slots mean nobody can hoard superstars.
- **Custom rosters.** Set how many Superstars, All-Stars, Starters, Rotation and Deep Bench players each coach drafts, or pick a preset (Balanced, Starting Five, Big Three, Superteams, Underdogs, Full Rotation).
- **Handicap mode** gives each coach their own roster build and auction budget. After a game, the loser can set the winner's handicap for the redraft.
- **Position-aware packs** are built around the spots each coach still needs. A live **lineup balance** readout (shooting, playmaking, rim protection, rebounding, depth) shows what each team is missing.
- **Optional extras:**
  - Underdog picks first, plus the **Equalizer** for lopsided drafts
  - Rerolls
  - Mystery packs
  - A **blind bid round**: both coaches pick in secret, and if they take the same player nobody gets him
  - **Keepers** when you redraft
  - A one-offer trade window

**Draft night presentation**
- The commissioner's podium intro.
- A 20/30/45-second **shot clock**: beeps in the last 5 seconds, then a buzzer and an auto-pick.
- Synthesized sound effects with a mute toggle.
- A full-screen **BOOM** with the player's headshot for every superstar pick.

**Game day**
- **Rules:** one slot-machine pull sets the quarter length (2–5 min) and a rule twist for both teams.
- **Challenges:** each coach picks a risk level (Easy, Medium or Hard), then spins a challenge of that difficulty. Completing it banks a reward for the **next draft**, and harder challenges pay more:
  - **Easy:** 🔒 Keeper, ⬆️ Tier Up (your lowest pick moves up a tier), or ➕ +1 Rotation player
  - **Medium:** ⏫ Double Tier Up, 🎯 Guaranteed All-Star, or ➕ +1 Starter
  - **Hard:** 💎 Guaranteed Superstar, 🌟 +1 All-Star, or 👑 +1 Superstar
- **Running it back:** if you keep the same squads instead of redrafting, an extra-player reward signs a free agent of that tier, and any other reward upgrades your weakest player. The Equalizer stays off in a draft where someone has earned a reward.
- Both rosters are listed with headshots.
- One-tap **share image** (1080×1920) of both squads for iMessage or Instagram.
- After each game the loser spins the **sabotage wheel** to inflict something on the winner next game.

**Team identity and rivalry**
- Each coach picks a team name, emoji and color.
- The **Rivalry** page keeps a permanent head-to-head record that survives new series:
  - wins and streaks
  - challenge hit rate
  - biggest blowout and closest game
  - how often the better-drafted team actually wins, and the biggest upsets
  - each coach's most-drafted players

Ratings live in `giddey-app/src/data/2k27-modern.json` and `2k27-alltime.json`, and headshots are matched to NBA.com player IDs in `nba-person-ids.json`.

## Tech Stack

- Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS 4
- No backend or database — fully client-side with bundled player data

## Running Locally

```bash
cd giddey-app
npm install
npm run dev
```

## License

ISC

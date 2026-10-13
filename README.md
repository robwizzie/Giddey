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

A head-to-head mode at [`/versus`](https://playgiddey.com/versus) for two people building teams to play against each other in NBA 2K27.

- **Real 2K27 ratings.** 209 current players and 136 All-Time legends. Choose Modern, All-Time, or both.
- **Fully customizable rosters.** Pick how many Superstars, All-Stars, Starters, Rotation and Deep Bench players each coach drafts (5–15 total), or use a preset: Balanced, Starting Five, Big Three, Superteams, Underdogs, Full Rotation. Rounds can be shuffled, and the Equalizer can be switched off.
- **Position-aware packs.** Every pack is built around the positions both coaches still need, with the closest-ranked fit pulled in when a coach is running out of picks. Cards that fill a need are tagged.
- **Settings any time.** Rename coaches or change draft settings mid-series from ⚙️ Settings.
- **Three draft styles.**
  - **Pack Snake:** a pack drops each round and both coaches pick from it.
  - **I Cut, You Choose:** one coach offers two cards and the other takes one.
  - **Franchise Wheel:** spin a franchise and the pack comes from that team.
- **Built-in balance.**
  - Both coaches draft from the same tier each round.
  - The coach with the lower team OVR picks first.
  - An **Equalizer** pick fires if the teams finish 1.5+ OVR apart.
  - A live fairness meter tracks the gap.
- **Extras:** Mystery packs, rerolls, a one-offer trade window, and copyable rosters for setting up in 2K.
- **Game-day wheels.** Spin for quarter length (always 5–8 min) and an optional rule twist. Each coach also spins a personal challenge; completing it earns a boost for the next game (Upgrade Pack, Bench Heist, Draft Priority, Clock Control, Late Scratch…).
- **Series tracking.** Record results, then run it back with the same squads or redraft. The loser of the last game wins the next coin toss.

Ratings live in `giddey-app/src/data/2k27-modern.json` and `2k27-alltime.json`.

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

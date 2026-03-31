# MULTI PSM

> Version 0.12.0 | Last updated: 2026-03-31

A retro-styled, browser-based football management simulation game inspired by classic 1991 management games. Manage your club across 4 divisions, compete in cup competitions, develop youth talent, and climb to the top.

Built with vanilla JavaScript, HTML5, and CSS3 -- no dependencies, no build step. Just open and play. Works offline as a PWA.

## How to Play

1. Open `index.html` in any modern web browser (or install as a PWA for offline play)
2. Choose 1-4 human players and pick your teams from Division 4
3. Toggle optional game modes (cups, youth academy, AI managers, etc.)
4. Click **Play** each week to advance the season

Save/load your progress at any time via JSON file export, save slots, or auto-save.

## Features

### Core Gameplay

- **4-Division League System** -- 64 teams (16 per division) with full round-robin seasons (30 matches)
- **Multiplayer** -- Up to 4 human managers in a shared game, each starting in Division 4
- **Promotion & Relegation** -- Top 2 promoted, bottom 2 relegated each season
- **Match Simulation** -- Position-weighted OVR, skill-aware engine with form & momentum bonuses
- **Save/Load** -- JSON file export, multi-slot save system, and auto-save after each match week
- **PWA Support** -- Install on your device and play offline

### AI Managers

- 5 distinct AI personality types controlling non-human teams
- Season-phase awareness (early, mid, late season strategies)
- Structured activity log with viewer and export
- Training decisions and season-end summaries logged

### Squad Management

- Squads of up to 25 players with 6 skill attributes (Pace, Shooting/Handling, Passing, Tackling, Heading, Stamina)
- **GK Handling skill** -- Goalkeepers use Handling instead of Shooting
- **Position-weighted OVR** -- Overall rating accounts for position-relevant skills
- Player positions: GK, DEF, MID, FWD
- Injury system (1-6 week absences), player aging, and automatic retirement at 37+
- Starting XI selection via the Tactics screen with formation-aware best XI auto-selection
- Player morale tracking
- Squad sorting options across squad, training, and tactics screens

### Training

- Assign individual skill training per player
- Quick training presets by position group (GK/DEF/MID/FWD)
- **Two-column training screen** -- your manual picks alongside assistant coach auto-assignments
- Assistant coach trains each player's weakest skill and takes over when your chosen skill reaches its target
- Training success affected by coach quality and player age
- Untrained skills slowly decline over time
- Young players (<22) receive a training bonus
- **Rare breakthrough training** -- 7% chance for a +2 skill gain per week

### Financial Management

- Weekly wage costs, gate income from home matches, and transfer market transactions
- Detailed weekly bank statements tracking all income and expenses
- Random financial events: TV bonuses, sponsorships, council grants, crowd violence fines
- Bankruptcy threshold at -£50k triggers sacking
- **Emergency loan system** for clubs in debt with user-selectable repayment terms (30-150 weeks)

### Transfer Market

- Buy and sell players from a pool of 200-250 available players
- Filter by position, overall rating (min/max), and age (min/max)
- Scouted players marked visually on the transfer list
- Transfer list refreshes every 9 weeks with alert notifications
- Player values scale with overall rating, age, division, and youth status

### Staff

- Four roles: Coach, Scout, Physio, Assistant Coach -- each with 5 quality tiers (Useless to Excellent)
- Coach improves training and team strength
- **Assistant Coach** -- automatically trains players' weakest skills on main team and youth academy
- Scout discovers discounted players via random events
- Physio speeds up injury recovery

### Career Management

- Receive club approach offers from other teams during the season
- Accept offers to transfer to a new club or resign from your current position
- Offers expire after 1 week if not accepted
- Career history follows the manager across clubs

### Ground Upgrades

- **Capacity**: 5k to 50k (increases gate revenue)
- **Safety**: Basic to World Class
- **Pitch**: Muddy to Perfect (boosts team strength)
- Unique procedurally-generated club logo crest for each team

### News Board

- Persistent event log with category filtering (multiple types at once)
- Time filters: All, Last Week
- Event types: transfers, training, injuries, cup results, financial events, and more

### Club History

- Season-by-season records and trophy count
- Streaks and records: longest win/unbeaten/losing streaks, biggest wins and losses, clean sheets
- History persists across club transfers

### UX Improvements

- Confirmation dialogs for important actions
- Formation tooltips showing position requirements
- Persistent notifications
- Color-coded match results: green for wins, yellow for draws, red for losses
- Auto-save to localStorage after each match week
- Multi-slot save system

## Optional Game Modes

Toggle these on or off at game setup:

| Mode | Description |
|------|-------------|
| **Board Confidence** | Confidence meter (0-100%) rises on wins, drops on losses. Sacked at 10% or below. |
| **Formations** | Choose from 6 tactical formations (4-4-2, 4-3-3, 3-5-2, 5-3-2, 4-5-1, 3-4-3) with position bonuses and formation-aware best XI auto-selection. |
| **Youth Academy** | Scout young prospects (age 16-18), upgrade academy quality and youth coach, potential bonus to training, graduate players after one season. |
| **Transfer Negotiation** | Multi-stage bidding for expensive transfers with counter-offers and minimum acceptance thresholds. |
| **Cup Competitions** | Division cups, National Cup (all 64 teams), and League Trophy with knockout brackets and prize money. |
| **AI Managers** | AI-controlled managers with 5 personality types, season-phase awareness, and activity logging. |

## Cup Competitions

When enabled, three tournament types run alongside the league:

- **Division Cups** -- Knockout within each division (every 3 weeks)
- **National Cup** -- All 64 teams in a single knockout bracket with division labels
- **League Trophy** -- Separate all-teams tournament (every 5 weeks) with division labels
- Gate income split 50/50 between both teams in cup matches; 100% to home team in league matches
- No home advantage bonus in cup matches
- Cup run momentum bonus for lower division teams facing higher division opponents
- Prize money scales by division and round

## Tech Stack

- **Vanilla JavaScript** (ES6+) -- no frameworks or libraries
- **HTML5 / CSS3** -- retro ZX Spectrum aesthetic (green phosphor on black, pixel fonts)
- **PWA** -- Service worker and manifest for offline play
- **Google Fonts** -- Press Start 2P, VT323
- **Zero dependencies** -- no npm, no build process

## Project Structure

```
index.html      -- Single-page app shell
app.js          -- Bootstrap and test hooks
data.js         -- Game data, constants, team/player generation
engine.js       -- Core simulation logic and game state
ui.js           -- User interface rendering and event handling
style.css       -- Retro ZX Spectrum styling
sw.js           -- Service worker for offline PWA support
manifest.json   -- PWA manifest
```

## Browser Requirements

- ES6+ JavaScript support
- CSS Grid & Flexbox
- File API (for save/load)
- Service Worker support (for offline PWA)

## License

All rights reserved.

# MULTI PSM

A retro-styled, browser-based football management simulation game inspired by classic 1991 management games. Manage your club across 4 divisions, compete in cup competitions, develop youth talent, and climb to the top.

Built with vanilla JavaScript, HTML5, and CSS3 -- no dependencies, no build step. Just open and play.

## How to Play

1. Open `index.html` in any modern web browser
2. Choose 1-4 human players and pick your teams from Division 4
3. Toggle optional game modes (cups, youth academy, etc.)
4. Click **Play** each week to advance the season

Save/load your progress at any time via JSON file export.

## Features

### Core Gameplay

- **4-Division League System** -- 64 teams (16 per division) with full round-robin seasons (30 matches)
- **Multiplayer** -- Up to 4 human managers in a shared game, each starting in Division 4
- **Promotion & Relegation** -- Top 2 promoted, bottom 2 relegated each season
- **Match Simulation** -- Results driven by team strength, formation, morale, home advantage, and coach/pitch quality
- **Save/Load** -- Full game state saved as JSON, reload anytime

### Squad Management

- Squads of up to 16 players with 6 skill attributes (Pace, Shooting, Passing, Tackling, Heading, Stamina)
- Player positions: GK, DEF, MID, FWD
- Injury system (1-6 week absences), player aging, and automatic retirement at 37+
- Starting XI selection via the Tactics screen
- Player morale tracking

### Training

- Assign individual skill training per player
- Quick training presets by position group (GK/DEF/MID/FWD)
- Training success affected by coach quality and player age
- Untrained skills slowly decline over time
- Young players (<22) receive a training bonus

### Financial Management

- Weekly wage costs, gate income from home matches, and transfer market transactions
- Detailed weekly bank statements tracking all income and expenses
- Random financial events: TV bonuses, sponsorships, council grants, crowd violence fines
- Bankruptcy threshold at -£50k triggers sacking

### Transfer Market

- Buy and sell players from a pool of 200-250 available players
- Filter by position, overall rating (min/max), and age (min/max)
- Scouted players marked visually on the transfer list
- Mid-season transfer list refresh
- Player values scale with overall rating, age, division, and youth status

### Staff

- Three roles: Coach, Scout, Physio -- each with 5 quality tiers (Useless to Excellent)
- Coach improves training and team strength
- Scout discovers discounted players via random events
- Physio speeds up injury recovery

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

## Optional Game Modes

Toggle these on or off at game setup:

| Mode | Description |
|------|-------------|
| **Board Confidence** | Confidence meter (0-100%) rises on wins, drops on losses. Sacked at 10% or below. |
| **Formations** | Choose from 6 tactical formations (4-4-2, 4-3-3, 3-5-2, 5-3-2, 4-5-1, 3-4-3) with position bonuses. |
| **Youth Academy** | Scout young prospects (age 16-18), upgrade academy quality and youth coach, graduate players after one season. |
| **Transfer Negotiation** | Multi-stage bidding for expensive transfers with counter-offers and minimum acceptance thresholds. |
| **Cup Competitions** | Division cups, National Cup (all 64 teams), and League Trophy with knockout brackets and prize money. |

## Cup Competitions

When enabled, three tournament types run alongside the league:

- **Division Cups** -- Knockout within each division (every 3 weeks)
- **National Cup** -- All 64 teams in a single knockout bracket
- **League Trophy** -- Separate all-teams tournament (every 5 weeks)
- Gate income split 50/50 between both teams in cup matches; 100% to home team in league matches
- Prize money scales by division and round

## Tech Stack

- **Vanilla JavaScript** (ES6+) -- no frameworks or libraries
- **HTML5 / CSS3** -- retro ZX Spectrum aesthetic (green phosphor on black, pixel fonts)
- **Google Fonts** -- Press Start 2P, VT323
- **Zero dependencies** -- no npm, no build process

## Project Structure

```
index.html   -- Single-page app shell
app.js       -- Bootstrap and test hooks
data.js      -- Game data, constants, team/player generation
engine.js    -- Core simulation logic and game state
ui.js        -- User interface rendering and event handling
style.css    -- Retro ZX Spectrum styling
```

## Browser Requirements

- ES6+ JavaScript support
- CSS Grid & Flexbox
- File API (for save/load)

## License

All rights reserved.

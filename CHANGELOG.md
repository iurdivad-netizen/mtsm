# Changelog

All notable changes to MULTI PSM are documented in this file.

## 2026-03-22

### Added
- Min/max age filters on the transfer list
- Multiple type filters on the news board (select more than one category at once)
- Overall rating column displayed next to age in squad, training, and tactics screens

### Fixed
- Transaction sync: missing recordFinance calls and weeklyFinances key collision

## 2026-03-21

### Added
- Youth academy quality upgrades and youth coach system (Basic to Elite tiers)
- Youth academy progression news and squad visibility for youth players
- Max overall filter on the transfer list
- Age and division multipliers for player transfer values
- Youth players valued at 30% of senior pricing
- Unique procedurally-generated club logo crest per team (replaces ASCII stadium graphic)
- Youth players graduate to normal valuation after one season
- Dynamic transfer value recalculation when overall rating changes

### Changed
- Renamed game to **MULTI PSM** with a proper title screen logo
- Player transfer values now scale directly with overall rating

### Fixed
- Youth academy refresh now adds prospects instead of replacing the pool

## 2026-03-20

### Added
- Attendance and ticket income for cup matches (75/25 home/away split)
- All division tables shown on end-of-season summary screen
- Club history button with season-by-season records and trophy count
- Streaks, records, and fun stats in club history (longest win/unbeaten/losing streaks, biggest wins/losses, clean sheets)
- Cup game revenue tracked in weekly bank statement
- Mid-season transfer list refresh
- 70+, 80+, 90+ overall rating filters on the transfer list
- "Last Week" time filter on the news board

### Fixed
- End-of-season tables no longer show zeroed stats
- League Trophy now completes before end of season
- Records section shows season stats for old saves with matchLog compatibility

## 2026-03-19

### Added
- National Cup and League Trophy knockout competitions
- Scouted players marked visually on the transfer list
- Dashboard stats always visible above buttons on all views

### Fixed
- Promotion/relegation now preserves team identity and shows all divisions
- Dashboard visibility check uses subView === 'menu' instead of !subView

### Changed
- Dashboard layout reordered: stats above buttons, news below

## 2026-03-18

### Added
- Initial release: Multi-Player Soccer Manager web game
- Save/load game feature (JSON file export/import)
- Random team selection option on setup screen
- 5 toggle game options: board confidence, formations, youth academy, negotiation, cup competition
- Starting XI selector on the Tactics screen
- Quick training buttons for position groups (GK/DEF/MID/FWD)
- News Board with persistent event log

### Fixed
- Match locations: shuffled fixture rounds for balanced home/away distribution
- Guaranteed max 2 consecutive same-venue games
- Gate income display added to match results
- Infinite recursion in pushNews helper

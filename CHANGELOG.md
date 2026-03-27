# Changelog

All notable changes to MULTI PSM are documented in this file.

## 2026-03-27

### Fixed
- UI now correctly displays 50/50 cup gate split instead of old 75/25

## 2026-03-26

### Added
- Potential bonus to youth academy training
- Rare breakthrough training: 7% chance for +2 skill gain per week
- Form & momentum bonus to match strength calculation
- Club division labels on National Cup and League Trophy displays
- Cup run momentum bonus for lower division teams facing higher opponents

### Changed
- Removed home advantage bonus from cup matches
- Cup gate income now split 50/50 between both clubs (was 75/25)

## 2026-03-25

### Added
- Transfer market refresh every 9 weeks with alert notification
- Color-coded match results: green for wins, yellow for draws, red for losses
- Squad-style sort options on the training screen
- Formation-aware best XI selection with custom OVR-based formation

### Changed
- Renamed Cup button to Division Cup with team status display
- Draw result color changed from white to yellow (accent color)

### Fixed
- Trophy history: corrected Best Finish stat and added null safety

## 2026-03-24

### Added
- Two-column training screen: user choice vs assistant coach auto-assignments
- Assistant coach takes over when user's chosen skill reaches target
- Two-column training UI mirrored to youth academy
- Emergency loan system for clubs in debt
- User-selectable loan repayment term (30-150 weeks, max 5 seasons)
- Manager history now follows across club transfers

### Fixed
- Crash when viewing career after resigning for offers
- Loan repayment: exported missing functions, added auto-deduction, extended to 40 weeks
- Youth academy not resetting on club transfer
- Main team assistant coach now resets on club transfer

## 2026-03-23

### Added
- Career management: club transfer offers and resignation
- Periodic club approach offers during the season (expire after 1 week)
- PWA support for offline gameplay (service worker + manifest)
- Confirmation dialogs, squad sorting, formation tooltips, and persistent notifications
- Assistant coach staff role for main team and youth academy
- Assistant coach trains each player's individual weakest skills
- Squad size increased to 25 players (initial generation remains 16)

### Fixed
- Youth player value not updating on graduation

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

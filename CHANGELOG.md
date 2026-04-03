# Changelog

All notable changes to MULTI PSM are documented in this file.

## v0.14.0 — 2026-04-02

### Fixed
- AI managers never upgrading staff (log overflow and financial gates)

## v0.13.0 — 2026-04-01

### Added
- AI-only simulation lab for studying AI personality behaviour (`simulation.html`)

### Fixed
- Match simulation now produces realistic football statistics
- AI manager log access uses direct state access instead of broken getter

## v0.12.0 — 2026-03-31

### Added
- Position-weighted OVR and skill-aware match engine
- Handling skill for GK (replaces Shooting for goalkeepers)
- AI manager training decisions and season-end summaries in activity log
- AI LOG button now always visible regardless of aiManagers option
- OVR recalculation on save load for backward compatibility

### Changed
- Removed redundant SHARE and PASTE buttons from title screen

## v0.11.0 — 2026-03-29

### Added
- AI Managers feature with 5 distinct personality types
- Auto-save to localStorage after each match week
- Season-phase AI awareness (early, mid, late season strategies)
- Season history tracking for AI managers
- Share codes for game states
- Multi-slot save system
- Structured AI manager activity log with viewer and export

### Fixed
- Trophy history recording wrong division after promotion/relegation

## v0.10.0 — 2026-03-27

### Added
- Difference-based match probability formula for more realistic results

### Fixed
- UI now correctly displays 50/50 cup gate split instead of old 75/25

## v0.9.0 — 2026-03-26

### Added
- Potential bonus to youth academy training
- Rare breakthrough training: 7% chance for +2 skill gain per week
- Form & momentum bonus to match strength calculation
- Club division labels on National Cup and League Trophy displays
- Cup run momentum bonus for lower division teams facing higher opponents

### Changed
- Removed home advantage bonus from cup matches
- Cup gate income now split 50/50 between both clubs (was 75/25)

## v0.8.0 — 2026-03-25

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

## v0.7.0 — 2026-03-24

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

## v0.6.0 — 2026-03-23

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

## v0.5.0 — 2026-03-22

### Added
- Min/max age filters on the transfer list
- Multiple type filters on the news board (select more than one category at once)
- Overall rating column displayed next to age in squad, training, and tactics screens

### Fixed
- Transaction sync: missing recordFinance calls and weeklyFinances key collision

## v0.4.0 — 2026-03-21

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

## v0.3.0 — 2026-03-20

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

## v0.2.0 — 2026-03-19

### Added
- National Cup and League Trophy knockout competitions
- Scouted players marked visually on the transfer list
- Dashboard stats always visible above buttons on all views

### Fixed
- Promotion/relegation now preserves team identity and shows all divisions
- Dashboard visibility check uses subView === 'menu' instead of !subView

### Changed
- Dashboard layout reordered: stats above buttons, news below

## v0.1.0 — 2026-03-18

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

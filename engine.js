/* ========= MTSM Game Engine ========= */
'use strict';

const MTSM_ENGINE = (() => {

  let state = null;

  // ===== GAME OPTIONS (toggles) =====
  const DEFAULT_OPTIONS = {
    boardConfidence: false,
    formationStrategy: false,
    youthAcademy: false,
    negotiation: false,
    cupPrizeMoney: false,
    aiManagers: false
  };

  function initGame(humanPlayers, options) {
    // humanPlayers = [{ name: 'Player 1', teamIndex: 0 }, ...]
    // options = { boardConfidence, formationStrategy, youthAcademy, negotiation, cupPrizeMoney }
    const gameOptions = { ...DEFAULT_OPTIONS, ...(options || {}) };

    // All humans start in Division 4 (index 3)
    const divisions = [];
    for (let d = 0; d < 4; d++) {
      const divTeams = [];
      for (let t = 0; t < 16; t++) {
        const globalIdx = d * 16 + t;
        const team = MTSM_DATA.generateTeam(MTSM_DATA.TEAM_NAMES[globalIdx], d);
        divTeams.push(team);
      }
      divisions.push({
        name: `Division ${d + 1}`,
        teams: divTeams,
        fixtures: MTSM_DATA.generateFixtures(divTeams.map(t => t.name)),
        currentRound: 0
      });
    }

    // Assign human players to Division 4
    for (let i = 0; i < humanPlayers.length; i++) {
      const hp = humanPlayers[i];
      const team = divisions[3].teams[hp.teamIndex];
      team.isHuman = true;
      team.humanPlayerIndex = i;
      team.humanName = hp.name;
      // Give human teams a small starting bonus
      team.balance += 25000;
      // Default formation
      if (gameOptions.formationStrategy) {
        team.formation = '4-4-2';
      }
    }

    // Assign AI managers to non-human teams (if enabled)
    let aiManagerData = null;
    if (gameOptions.aiManagers) {
      aiManagerData = {};
      const types = MTSM_DATA.AI_MANAGER_TYPES;
      const usedNames = new Set();
      for (let d = 0; d < 4; d++) {
        for (let t = 0; t < 16; t++) {
          const team = divisions[d].teams[t];
          if (team.isHuman) continue;
          const personality = types[Math.floor(Math.random() * types.length)];
          // Pick a unique manager name
          let mgrName;
          do {
            mgrName = MTSM_DATA.AI_MANAGER_NAMES[Math.floor(Math.random() * MTSM_DATA.AI_MANAGER_NAMES.length)];
          } while (usedNames.has(mgrName) && usedNames.size < MTSM_DATA.AI_MANAGER_NAMES.length);
          usedNames.add(mgrName);
          // Assign a formation based on personality
          if (gameOptions.formationStrategy) {
            team.formation = personality.preferredFormation;
          }
          // Set initial training for all players based on personality
          _applyAITrainingStyle(team, personality);
          aiManagerData[team.name] = {
            personality: personality.key,
            managerName: mgrName,
            lastTransferWeek: 0,
            lastStaffWeek: 0,
            lastGroundWeek: 0,
            lastFormationWeek: 0,
            consecutiveLosses: 0,
            seasonBuys: 0,
            seasonSells: 0,
            seasonHistory: []
          };
        }
      }
    }

    const transferPool = MTSM_DATA.generateTransferPool(200);

    // Generate cup brackets if cup option is on
    let cup = null;
    if (gameOptions.cupPrizeMoney) {
      cup = generateCupBrackets(divisions);
    }

    // Generate national cup brackets if cup option is on
    let nationalCup = null;
    let leagueTrophy = null;
    if (gameOptions.cupPrizeMoney) {
      nationalCup = generateNationalCupBracket(divisions);
      leagueTrophy = generateNationalCupBracket(divisions);
    }

    // Generate youth academy pools if option is on
    let youthAcademy = null;
    let youthAcademyData = null;
    if (gameOptions.youthAcademy) {
      youthAcademy = {};
      youthAcademyData = {};
      for (let i = 0; i < humanPlayers.length; i++) {
        youthAcademyData[i] = {
          quality: 0, youthCoach: 0,
          asstCoach: 0,           // youth assistant coach quality (0=None, 1-4)
          asstTargetLevel: 99    // threshold to switch to next lowest skill
        };
        const prospectCount = MTSM_DATA.ACADEMY_QUALITY.prospectCount[0];
        const skillBonus = MTSM_DATA.ACADEMY_QUALITY.baseSkillBonus[0];
        youthAcademy[i] = generateYouthPlayers(prospectCount, skillBonus);
      }
    }

    // Initialize club history for each human player
    const clubHistory = {};
    const matchLog = {};
    const assistantCoachData = {};
    for (let i = 0; i < humanPlayers.length; i++) {
      clubHistory[i] = [];
      matchLog[i] = [];
      assistantCoachData[i] = {
        quality: 0,          // 0=None, 1-4 = tiers
        targetLevel: 99      // switch threshold: when lowest skill reaches this, move to next lowest
      };
    }

    state = {
      divisions,
      transferPool,
      season: 1,
      week: 1,
      currentDivision: 3, // viewing division
      currentPlayerIndex: 0, // which human player's turn
      humanPlayers: humanPlayers.map((hp, i) => ({
        ...hp,
        division: 3,
        teamIndex: hp.teamIndex,
        sacked: false,
        boardConfidence: 50 // starts neutral
      })),
      phase: 'menu', // menu, match_day, end_season, game_over
      news: [],
      newsLog: [],
      matchResults: [],
      seasonOver: false,
      options: gameOptions,
      cup,
      nationalCup,
      leagueTrophy,
      youthAcademy,
      youthAcademyData,
      clubHistory,
      matchLog,
      clubOffers: {},
      assistantCoachData,
      aiManagerData,
      aiManagerLog: [],   // structured AI decision log for analysis
      transferMarketRefreshedWeek: 0,
      transferMarketAlert: false
    };

    return state;
  }

  // Helper: apply initial training based on AI personality style
  // leaguePos and totalTeams are optional — when provided, enable league-position-aware training
  function _applyAITrainingStyle(team, personality, leaguePos, totalTeams) {
    // League-position-aware overrides
    const inBottom4 = leaguePos && totalTeams && leaguePos > totalTeams - 4;
    const inTop4 = leaguePos && totalTeams && leaguePos <= 4;

    for (const player of team.players) {
      const pSkills = Object.keys(player.skills);
      const focusSkills = MTSM_DATA.POSITION_SKILLS_MAP[player.position]?.focus || ['Passing'];

      // Bottom 4: prioritize Tackling and Heading (filtered to player's own skills)
      if (inBottom4) {
        const defSkills = ['Tackling', 'Heading'].filter(s => player.skills[s] !== undefined);
        const sorted = defSkills.sort((a, b) => player.skills[a] - player.skills[b]);
        player.training = sorted[0] || pSkills.sort((a, b) => player.skills[a] - player.skills[b])[0];
        continue;
      }
      // Top 4: allow offensive training focus
      if (inTop4) {
        const sorted = focusSkills.slice().sort((a, b) => player.skills[a] - player.skills[b]);
        player.training = sorted[0];
        continue;
      }

      if (personality.trainingStyle === 'weakest') {
        const sorted = pSkills.slice().sort((a, b) => player.skills[a] - player.skills[b]);
        player.training = sorted[0];
      } else if (personality.trainingStyle === 'positional') {
        const sorted = focusSkills.slice().sort((a, b) => player.skills[a] - player.skills[b]);
        player.training = sorted[0];
      } else if (personality.trainingStyle === 'development') {
        if (player.age <= 24) {
          player.training = focusSkills.slice().sort((a, b) => player.skills[a] - player.skills[b])[0];
        } else {
          const sorted = pSkills.slice().sort((a, b) => player.skills[a] - player.skills[b]);
          player.training = sorted[0];
        }
      } else if (personality.trainingStyle === 'random') {
        player.training = MTSM_DATA.pick(pSkills);
      } else {
        // minimal — only train if overall is low
        if (player.overall < 45) {
          const sorted = pSkills.slice().sort((a, b) => player.skills[a] - player.skills[b]);
          player.training = sorted[0];
        }
      }
    }
  }

  function getState() { return state; }

  function getCurrentHumanTeam() {
    if (!state) return null;
    const hp = state.humanPlayers[state.currentPlayerIndex];
    if (!hp || hp.sacked || hp._lookingForClub) return null;
    return state.divisions[hp.division].teams[hp.teamIndex];
  }

  function getAllHumanTeams() {
    return state.humanPlayers
      .filter(hp => !hp.sacked)
      .map(hp => ({
        ...hp,
        team: state.divisions[hp.division].teams[hp.teamIndex]
      }));
  }

  // ===== FORMATION DEFINITIONS =====
  const FORMATIONS = {
    '4-4-2': { DEF: 4, MID: 4, FWD: 2, bonus: {} },
    '4-3-3': { DEF: 4, MID: 3, FWD: 3, bonus: { FWD: 3 } },
    '3-5-2': { DEF: 3, MID: 5, FWD: 2, bonus: { MID: 4 } },
    '5-3-2': { DEF: 5, MID: 3, FWD: 2, bonus: { DEF: 3 } },
    '4-5-1': { DEF: 4, MID: 5, FWD: 1, bonus: { MID: 3, DEF: 1 } },
    '3-4-3': { DEF: 3, MID: 4, FWD: 3, bonus: { FWD: 4 } },
    'custom': { DEF: 0, MID: 0, FWD: 0, bonus: {}, isAuto: true }
  };

  // ===== MATCH SIMULATION =====
  function getStartingEleven(team) {
    const available = team.players.filter(p => p.injured === 0);
    if (available.length < 11) return available; // not enough

    // If team has a manual startingXI, use it (filter out injured)
    if (team.startingXI && team.startingXI.length === 11) {
      const manual = team.startingXI
        .map(id => available.find(p => p.id === id))
        .filter(Boolean);
      if (manual.length === 11) return manual;
    }

    // Fallback: auto-pick best 11 respecting formation if set
    return _autoPickByFormation(available, team.formation);
  }

  // Internal helper: pick best 11 from available players, respecting formation slots if provided.
  // Falls back to best OVR if formation is absent, 'custom', or slots can't be fully filled.
  function _autoPickByFormation(available, formationKey) {
    const formation = formationKey && !FORMATIONS[formationKey]?.isAuto ? FORMATIONS[formationKey] : null;

    if (!formation) {
      // Absolute best OVR — no positional constraint
      return [...available].sort((a, b) => b.overall - a.overall).slice(0, 11);
    }

    const selected = [];
    const usedIds = new Set();

    // 1 GK
    const bestGK = [...available].filter(p => p.position === 'GK').sort((a, b) => b.overall - a.overall)[0];
    if (bestGK) { selected.push(bestGK); usedIds.add(bestGK.id); }

    // Fill positional slots per formation
    for (const pos of ['DEF', 'MID', 'FWD']) {
      const needed = formation[pos] || 0;
      [...available]
        .filter(p => p.position === pos && !usedIds.has(p.id))
        .sort((a, b) => b.overall - a.overall)
        .slice(0, needed)
        .forEach(p => { selected.push(p); usedIds.add(p.id); });
    }

    // Fill any remaining slots (formation positions under-staffed) with best available
    if (selected.length < 11) {
      [...available]
        .filter(p => !usedIds.has(p.id))
        .sort((a, b) => b.overall - a.overall)
        .slice(0, 11 - selected.length)
        .forEach(p => { selected.push(p); usedIds.add(p.id); });
    }

    return selected.slice(0, 11);
  }

  // Compute average of a specific skill across players of a given position in the starting XI.
  // Falls back to fallbackSkill if the primary skill doesn't exist (e.g. GK has Handling not Shooting).
  function _avgSkill(players, position, skill, fallbackSkill) {
    const group = players.filter(p => p.position === position);
    if (group.length === 0) return 0;
    return group.reduce((sum, p) => sum + (p.skills[skill] !== undefined ? p.skills[skill] : (p.skills[fallbackSkill] || 0)), 0) / group.length;
  }

  function calculateTeamStrength(team, options) {
    const available = team.players.filter(p => p.injured === 0);
    if (available.length < 11) return { overall: 30, attack: 30, defense: 30, midfield: 30 };

    const starting = getStartingEleven(team);

    // --- Base OVR (weighted by position) ---
    let baseOvr = 0;
    for (const p of starting) {
      baseOvr += p.overall;
    }
    baseOvr /= 11;

    // --- Skill-based sub-scores (0-99 scale) ---
    // Attack: FWD shooting + FWD pace + MID passing (chance creation & finishing)
    const fwdShooting = _avgSkill(starting, 'FWD', 'Shooting');
    const fwdPace     = _avgSkill(starting, 'FWD', 'Pace');
    const midPassing  = _avgSkill(starting, 'MID', 'Passing');
    const fwdCount    = starting.filter(p => p.position === 'FWD').length;
    const attackRaw   = fwdCount > 0
      ? (fwdShooting * 0.45 + fwdPace * 0.25 + midPassing * 0.30)
      : (midPassing * 0.6 + _avgSkill(starting, 'MID', 'Shooting') * 0.4);

    // Defense: DEF tackling + DEF heading + GK handling
    const defTackling  = _avgSkill(starting, 'DEF', 'Tackling');
    const defHeading   = _avgSkill(starting, 'DEF', 'Heading');
    const gkHandling   = _avgSkill(starting, 'GK', 'Handling', 'Tackling');
    const defenseRaw   = defTackling * 0.40 + defHeading * 0.25 + gkHandling * 0.35;

    // Midfield: MID passing + MID stamina (game control & endurance)
    const midStamina   = _avgSkill(starting, 'MID', 'Stamina');
    const midCount     = starting.filter(p => p.position === 'MID').length;
    const midfieldRaw  = midPassing * 0.55 + midStamina * 0.45;

    // --- Bonuses (same as before) ---
    let bonus = 0;

    // Midfield loading bonus (famous game quirk!)
    if (midCount >= 5) bonus += 5;
    if (midCount >= 6) bonus += 3;

    // Formation bonus (if enabled)
    if (state && state.options && state.options.formationStrategy && team.formation) {
      const formation = FORMATIONS[team.formation];
      if (formation && formation.bonus) {
        for (const [pos, b] of Object.entries(formation.bonus)) {
          const posCount = starting.filter(p => p.position === pos).length;
          const idealCount = formation[pos] || 0;
          if (posCount >= idealCount) {
            bonus += b;
          }
        }
      }
    }

    // Coach bonus
    bonus += team.staff.Coach.quality * 2;

    // Pitch bonus
    bonus += team.ground.pitch;

    // Morale
    const avgMorale = starting.reduce((s, p) => s + p.morale, 0) / starting.length;
    bonus += (avgMorale - 50) / 10;

    // Form & momentum
    if (team.form && team.form.length > 0) {
      const wins = team.form.filter(f => f === 'W').length;
      const losses = team.form.filter(f => f === 'L').length;
      const formLen = team.form.length;
      bonus += wins - losses;

      let streak = 1;
      for (let i = formLen - 2; i >= 0; i--) {
        if (team.form[i] === team.form[formLen - 1]) streak++;
        else break;
      }
      const lastResult = team.form[formLen - 1];
      if (lastResult === 'W' && streak >= 3) bonus += streak;
      if (lastResult === 'L' && streak >= 3) bonus -= streak;
    }

    // Cup run bonus
    if (options && options.isCup && team.cupRunWins > 0) {
      const divIdx = options.divisionIndex !== undefined ? options.divisionIndex : 3;
      const perWinBonus = Math.max(0, 3 - divIdx);
      bonus += team.cupRunWins * perWinBonus;
    }

    return {
      overall: Math.max(10, baseOvr + bonus),
      attack: Math.max(5, attackRaw + bonus * 0.3),
      defense: Math.max(5, defenseRaw + bonus * 0.3),
      midfield: Math.max(5, midfieldRaw + bonus * 0.3)
    };
  }

  // Poisson random variate generator (Knuth algorithm)
  function _poissonRandom(lambda) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }

  function simulateMatch(homeTeam, awayTeam, options) {
    const homeOpts = options ? { ...options, divisionIndex: options.divisionIndex } : undefined;
    const awayOpts = options ? { ...options, divisionIndex: options.awayDivisionIndex } : undefined;
    const home = calculateTeamStrength(homeTeam, homeOpts);
    const away = calculateTeamStrength(awayTeam, awayOpts);

    // Home advantage (not applied in cup matches)
    const homeAdv = (options && options.isCup) ? 0 : 5;

    // --- Skill-aware goal calculation using Poisson model ---
    // Calibrated to real-world benchmarks: ~2.7 goals/match,
    // ~45% home wins, ~27% draws, ~28% away wins
    const SCALE = 200;

    // Midfield battle influences chance creation for both teams
    const midDiff = (home.midfield - away.midfield) / SCALE;

    // Attack vs defense matchup determines expected goals per team
    const homeAttackEdge = (home.attack - away.defense + homeAdv) / SCALE + midDiff * 0.3;
    const awayAttackEdge = (away.attack - home.defense) / SCALE - midDiff * 0.3;

    // Base expected goals per team (real-world calibrated), modified by strength
    const homeExpected = Math.max(0.30, 1.50 + homeAttackEdge * 2.0);
    const awayExpected = Math.max(0.20, 1.15 + awayAttackEdge * 2.0);

    // Generate goals from Poisson distribution
    let homeGoals = _poissonRandom(homeExpected);
    let awayGoals = _poissonRandom(awayExpected);

    return { homeGoals, awayGoals };
  }

  function recordFinance(team, type, amount, label) {
    if (!team.isHuman || !state.weeklyFinances) return;
    // Find the human team index
    for (let i = 0; i < state.humanPlayers.length; i++) {
      const hp = state.humanPlayers[i];
      if (hp.sacked) continue;
      const t = state.divisions[hp.division].teams[hp.teamIndex];
      if (t === team && state.weeklyFinances[i]) {
        state.weeklyFinances[i].push({ type, amount, label });
        break;
      }
    }
  }

  function pushNews(entry) {
    state.news.push(entry);
    state.newsLog.push({ ...entry, season: state.season, week: state.week });
    // Keep log capped at 200 entries
    if (state.newsLog.length > 200) state.newsLog.splice(0, state.newsLog.length - 200);
  }

  function playMatchDay() {
    state.matchResults = [];
    state.news = [];

    // Reset weekly finances for all human teams
    state.weeklyFinances = {};
    for (let i = 0; i < state.humanPlayers.length; i++) {
      if (state.humanPlayers[i].sacked) continue;
      state.weeklyFinances[i] = [];
    }

    for (let d = 0; d < 4; d++) {
      const div = state.divisions[d];
      if (div.currentRound >= div.fixtures.length) continue;

      const round = div.fixtures[div.currentRound];
      const divResults = [];

      for (const [homeIdx, awayIdx] of round) {
        const homeTeam = div.teams[homeIdx];
        const awayTeam = div.teams[awayIdx];
        const result = simulateMatch(homeTeam, awayTeam);

        // Update stats
        homeTeam.played++;
        awayTeam.played++;
        homeTeam.goalsFor += result.homeGoals;
        homeTeam.goalsAgainst += result.awayGoals;
        awayTeam.goalsFor += result.awayGoals;
        awayTeam.goalsAgainst += result.homeGoals;

        if (result.homeGoals > result.awayGoals) {
          homeTeam.won++; homeTeam.points += 3;
          awayTeam.lost++;
          homeTeam.form.push('W'); awayTeam.form.push('L');
        } else if (result.homeGoals < result.awayGoals) {
          awayTeam.won++; awayTeam.points += 3;
          homeTeam.lost++;
          homeTeam.form.push('L'); awayTeam.form.push('W');
        } else {
          homeTeam.drawn++; homeTeam.points += 1;
          awayTeam.drawn++; awayTeam.points += 1;
          homeTeam.form.push('D'); awayTeam.form.push('D');
        }

        // Keep last 5 form
        if (homeTeam.form.length > 5) homeTeam.form.shift();
        if (awayTeam.form.length > 5) awayTeam.form.shift();

        // Gate receipts
        const attendance = calculateAttendance(homeTeam, d);
        const gateIncome = attendance * (d === 0 ? 25 : d === 1 ? 18 : d === 2 ? 12 : 8);
        homeTeam.balance += gateIncome;
        recordFinance(homeTeam, 'income', gateIncome, 'League gate income (home)');

        divResults.push({
          division: d,
          home: homeTeam.name,
          away: awayTeam.name,
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
          attendance,
          gateIncome,
          isHumanMatch: homeTeam.isHuman || awayTeam.isHuman
        });

        // Log match for human team(s) - used for streaks/records
        if (homeTeam.isHuman || awayTeam.isHuman) {
          for (const hp of state.humanPlayers) {
            if (hp.sacked) continue;
            const t = state.divisions[hp.division].teams[hp.teamIndex];
            if (t !== homeTeam && t !== awayTeam) continue;
            const isHome = t === homeTeam;
            const goalsFor = isHome ? result.homeGoals : result.awayGoals;
            const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
            const opponent = isHome ? awayTeam.name : homeTeam.name;
            const outcome = goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D';
            const hpIdx = state.humanPlayers.indexOf(hp);
            if (!state.matchLog) state.matchLog = {};
            if (!state.matchLog[hpIdx]) state.matchLog[hpIdx] = [];
            state.matchLog[hpIdx].push({
              week: state.week,
              opponent,
              isHome,
              goalsFor,
              goalsAgainst,
              outcome
            });
          }
        }
      }

      div.currentRound++;
      state.matchResults.push({ division: d, results: divResults });
    }

    // Process weekly costs
    processWeeklyCosts();

    // Process training
    processTraining();

    // Heal injuries
    processInjuries();

    // Random events
    processRandomEvents();

    // AI Manager decisions (if enabled)
    processAIManagerDecisions();

    // Age/retirement at season boundary
    state.week++;

    // Check for season end
    if (state.divisions[0].currentRound >= state.divisions[0].fixtures.length) {
      state.seasonOver = true;
    }

    // Board confidence updates (if enabled)
    if (state.options.boardConfidence) {
      for (const hp of state.humanPlayers) {
        if (hp.sacked) continue;
        const team = state.divisions[hp.division].teams[hp.teamIndex];
        // Check last match result for this team
        for (const divRes of state.matchResults) {
          for (const r of divRes.results) {
            if (!r.isHumanMatch) continue;
            const isHome = r.home === team.name;
            const isAway = r.away === team.name;
            if (!isHome && !isAway) continue;
            const won = (isHome && r.homeGoals > r.awayGoals) || (isAway && r.awayGoals > r.homeGoals);
            const drew = r.homeGoals === r.awayGoals;
            if (won) {
              hp.boardConfidence = Math.min(100, hp.boardConfidence + 6);
            } else if (drew) {
              hp.boardConfidence = Math.min(100, hp.boardConfidence + 1);
            } else {
              hp.boardConfidence = Math.max(0, hp.boardConfidence - 5);
            }
            // Bonus/penalty for league position
            const table = getLeagueTable(hp.division);
            const pos = table.findIndex(t => t.name === team.name) + 1;
            if (pos <= 2) hp.boardConfidence = Math.min(100, hp.boardConfidence + 1);
            if (pos >= 15) hp.boardConfidence = Math.max(0, hp.boardConfidence - 1);
          }
        }
        // Sack if confidence drops too low
        if (hp.boardConfidence <= 10) {
          hp.sacked = true;
          team.isHuman = false;
          pushNews({
            type: 'SACKED',
            text: `The board has SACKED ${hp.name} as manager of ${team.name}! Confidence was at rock bottom.`
          });
        }
      }
    }

    // Cup matches (if enabled)
    if (state.options.cupPrizeMoney && state.cup) {
      processCupRound();
    }

    // National Cup (plays every 5 weeks)
    if (state.options.cupPrizeMoney && state.nationalCup && !state.nationalCup.finished && state.week % 5 === 0) {
      processNationalCupRound('nationalCup', NATIONAL_CUP_PRIZE_MONEY, 'National Cup');
    }

    // League Trophy (plays every 5 weeks, offset by 2)
    if (state.options.cupPrizeMoney && state.leagueTrophy && !state.leagueTrophy.finished && state.week % 5 === 2) {
      processNationalCupRound('leagueTrophy', LEAGUE_TROPHY_PRIZE_MONEY, 'League Trophy');
    }

    // Youth academy refresh (if enabled) — adds new prospects to pool up to capacity
    if (state.options.youthAcademy && state.youthAcademy && state.week % 4 === 0) {
      for (let i = 0; i < state.humanPlayers.length; i++) {
        if (state.humanPlayers[i].sacked) continue;
        const ad = (state.youthAcademyData && state.youthAcademyData[i]) || { quality: 0, youthCoach: 0 };
        const maxCap = MTSM_DATA.ACADEMY_QUALITY.maxCapacity[ad.quality];
        const currentPool = state.youthAcademy[i] || [];
        const slotsAvailable = Math.max(0, maxCap - currentPool.length);
        if (slotsAvailable > 0) {
          const newCount = Math.min(MTSM_DATA.ACADEMY_QUALITY.prospectCount[ad.quality], slotsAvailable);
          const skillBonus = MTSM_DATA.ACADEMY_QUALITY.baseSkillBonus[ad.quality];
          const newProspects = generateYouthPlayers(newCount, skillBonus);
          state.youthAcademy[i] = currentPool.concat(newProspects);
          pushNews({ type: 'ACADEMY', text: `${newCount} new youth prospect${newCount !== 1 ? 's have' : ' has'} arrived at the academy!` });
        }
      }
    }

    // Youth assistant coach: auto-assign training for academy prospects (per-player)
    // Respects userTraining; takes over when user's chosen skill reaches target
    if (state.options.youthAcademy && state.youthAcademy && state.youthAcademyData) {
      for (let i = 0; i < state.humanPlayers.length; i++) {
        if (state.humanPlayers[i].sacked) continue;
        const ad = state.youthAcademyData[i];
        if (!ad || (ad.asstCoach || 0) <= 0) continue;
        const academy = state.youthAcademy[i];
        if (!academy) continue;
        const target = ad.asstTargetLevel || 99;
        for (const player of academy) {
          // If user has manually set training, check if it's maxed
          if (player.userTraining) {
            if (player.skills[player.userTraining] >= target) {
              // User's chosen skill is maxed — auto-assign instead
              const sorted = Object.keys(player.skills).sort((a, b) => player.skills[a] - player.skills[b]);
              player.training = sorted[0] === player.userTraining ? sorted[1] : sorted[0];
            } else {
              player.training = player.userTraining;
            }
            continue;
          }
          // Auto-pick the two lowest skills for THIS specific prospect
          const sorted = Object.keys(player.skills).sort((a, b) => player.skills[a] - player.skills[b]);
          const sk1 = sorted[0];
          const sk2 = sorted[1];
          if (player.training === sk1 && player.skills[sk1] >= target) {
            player.training = sk2;
          } else if (player.training === sk2 && player.skills[sk2] >= target) {
            player.training = sk1;
          } else if (!player.training || (player.training !== sk1 && player.training !== sk2)) {
            player.training = player.skills[sk1] <= player.skills[sk2] ? sk1 : sk2;
          }
          if (player.skills[sk1] >= target && player.skills[sk2] >= target) {
            player.training = player.skills[sk1] <= player.skills[sk2] ? sk1 : sk2;
          }
        }
      }
    }

    // Sync userTraining for youth prospects (when no youth assistant coach)
    if (state.options.youthAcademy && state.youthAcademy && state.youthAcademyData) {
      for (let i = 0; i < state.humanPlayers.length; i++) {
        if (state.humanPlayers[i].sacked) continue;
        const ad = state.youthAcademyData[i];
        if (ad && (ad.asstCoach || 0) > 0) continue; // already handled above
        const academy = state.youthAcademy[i];
        if (!academy) continue;
        for (const player of academy) {
          if (player.userTraining) {
            player.training = player.userTraining;
          }
        }
      }
    }

    // Youth coach training (if enabled) — trains academy prospects each week
    if (state.options.youthAcademy && state.youthAcademy && state.youthAcademyData) {
      for (let i = 0; i < state.humanPlayers.length; i++) {
        if (state.humanPlayers[i].sacked) continue;
        const ad = state.youthAcademyData[i];
        if (!ad || ad.youthCoach <= 0) continue;
        const academy = state.youthAcademy[i];
        if (!academy) continue;
        const coachBonus = MTSM_DATA.YOUTH_COACH_QUALITY.trainBonus[ad.youthCoach];
        // Youth assistant coach adds training bonus
        const asstBonus = (ad.asstCoach || 0) > 0 ? MTSM_DATA.ASST_COACH_QUALITY.trainBonus[ad.asstCoach] : 0;
        for (const player of academy) {
          // Youth coach trains targeted skill if set, otherwise random
          const skill = player.training || MTSM_DATA.pick(Object.keys(player.skills));
          let trainChance = 0.15 + coachBonus + asstBonus;
          if (player.potential) {
            trainChance += (player.potential - 50) / 200;
          }
          if (Math.random() < trainChance) {
            const oldSkill = player.skills[skill];
            // Rare breakthrough: 7% chance to gain +2 instead of +1
            const gain = Math.random() < 0.07 ? 2 : 1;
            player.skills[skill] = Math.min(99, player.skills[skill] + gain);
            player.overall = Math.round(
              MTSM_DATA.calcOverall(player.position, player.skills)
            );
            // Recalculate value
            const ageMult = player.age <= 22 ? 1.3 - (player.age - 17) * 0.04 : 1.0;
            player.value = Math.round(player.overall * 10000 * ageMult * 0.3);
            pushNews({ type: 'ACADEMY', text: `Youth prospect ${player.name} improved ${skill} (${oldSkill}→${player.skills[skill]}) in academy training.` });
          }
        }
      }
    }

    // Transfer market refresh every 9 weeks
    if (state.week > 0 && state.week % 9 === 0 && state.transferMarketRefreshedWeek !== state.week) {
      const newPlayers = MTSM_DATA.generateTransferPool(30);
      state.transferPool = [...state.transferPool.slice(-150), ...newPlayers];
      state.transferMarketRefreshedWeek = state.week;
      state.transferMarketAlert = true;
      pushNews({ type: 'TRANSFER', text: 'The transfer market has been updated with fresh players available!' });
    }

    // Check if any human is bankrupt
    for (const hp of state.humanPlayers) {
      if (hp.sacked) continue;
      const team = state.divisions[hp.division].teams[hp.teamIndex];
      if (team.balance < -50000) {
        hp.sacked = true;
        team.isHuman = false;
        pushNews({
          type: 'SACKED',
          text: `${hp.name} has been SACKED as manager of ${team.name} due to massive debt!`
        });
      }
    }

    // Expire club approach offers after 1 week
    if (state.clubOffers) {
      for (const idx of Object.keys(state.clubOffers)) {
        if (state.clubOffers[idx] && state.week - state.clubOffers[idx].week >= 1) {
          delete state.clubOffers[idx];
        }
      }
    }

    // Periodic club approach offers (every 6 weeks, starting week 6)
    if (state.week >= 6 && state.week % 6 === 0) {
      if (!state.clubOffers) state.clubOffers = {};
      for (let i = 0; i < state.humanPlayers.length; i++) {
        const hp = state.humanPlayers[i];
        if (hp.sacked || hp._lookingForClub) continue;
        // Only generate if manager has decent performance (score > 30)
        const perfScore = _getManagerPerformanceScore(i);
        // Chance of getting approached: higher perf = higher chance
        const approachChance = Math.min(0.8, perfScore / 100);
        if (Math.random() < approachChance) {
          const offers = generateClubOffers(i);
          // Filter: only keep offers from equal or higher divisions (clubs poach upward)
          const validOffers = offers.filter(o => o.division <= hp.division);
          if (validOffers.length > 0) {
            state.clubOffers[i] = { week: state.week, offers: validOffers };
            const bestDiv = Math.min(...validOffers.map(o => o.division));
            pushNews({
              type: 'APPROACH',
              text: `${validOffers.length} club${validOffers.length > 1 ? 's have' : ' has'} approached ${hp.name} with management offers! (Best: Division ${bestDiv + 1})`
            });
          }
        }
      }
    }

    return state.matchResults;
  }

  function calculateAttendance(team, divisionIndex) {
    const capacityLevels = MTSM_DATA.GROUND_UPGRADES.capacity.levels;
    const maxCap = capacityLevels[team.ground.capacity];
    const basePct = 0.5 + (team.points / (team.played * 3 || 1)) * 0.3;
    const formBonus = team.form.filter(f => f === 'W').length * 0.04;
    const divBonus = (3 - divisionIndex) * 0.05;
    const fillPct = Math.min(1, basePct + formBonus + divBonus + Math.random() * 0.15);
    return Math.floor(maxCap * fillPct);
  }

  function processWeeklyCosts() {
    for (const div of state.divisions) {
      for (const team of div.teams) {
        const playerWages = team.players.reduce((s, p) => s + p.wage, 0);
        const staffWages = Object.values(team.staff).reduce((s, st) => s + st.wage, 0);
        // Youth coach wage (if applicable)
        let youthCoachWage = 0;
        let asstCoachWage = 0;
        let youthAsstCoachWage = 0;
        if (team.isHuman) {
          const hpIdx = team.humanPlayerIndex;
          if (state.options.youthAcademy && state.youthAcademyData) {
            const ad = state.youthAcademyData[hpIdx];
            if (ad && ad.youthCoach > 0) {
              youthCoachWage = MTSM_DATA.YOUTH_COACH_QUALITY.costs[ad.youthCoach];
            }
            if (ad && (ad.asstCoach || 0) > 0) {
              youthAsstCoachWage = MTSM_DATA.ASST_COACH_QUALITY.costs[ad.asstCoach];
            }
          }
          if (state.assistantCoachData) {
            const ac = state.assistantCoachData[hpIdx];
            if (ac && ac.quality > 0) {
              asstCoachWage = MTSM_DATA.ASST_COACH_QUALITY.costs[ac.quality];
            }
          }
        }
        const totalWages = playerWages + staffWages + youthCoachWage + asstCoachWage + youthAsstCoachWage;
        team.balance -= totalWages;
        team.weeklyWages = totalWages;
        recordFinance(team, 'expense', totalWages, 'Wages (players + staff)');

        // Automatic loan repayment
        if (team.loan && team.loan.remaining > 0) {
          const payment = Math.min(team.loan.weeklyRepayment, team.loan.remaining);
          team.balance -= payment;
          team.loan.remaining -= payment;
          recordFinance(team, 'expense', payment, 'Loan repayment');
          if (team.loan.remaining <= 0) {
            delete team.loan;
          }
        }
      }
    }
  }

  // Assistant coach: auto-assign training for players on human teams
  // Each player gets their own two skills based on their individual weakest stats
  // Only kicks in when the player has no user-assigned training (userTraining is null)
  function applyAssistantCoachLogic() {
    if (!state.assistantCoachData) return;
    for (let i = 0; i < state.humanPlayers.length; i++) {
      const hp = state.humanPlayers[i];
      if (hp.sacked) continue;
      const ac = state.assistantCoachData[i];
      if (!ac || ac.quality <= 0) continue;
      const team = state.divisions[hp.division].teams[hp.teamIndex];
      const target = ac.targetLevel || 99;
      for (const player of team.players) {
        if (player.injured > 0) continue;
        // If user has manually set training but the skill has reached the target,
        // the assistant coach takes over and picks the next weakest skill
        if (player.userTraining) {
          if (player.skills[player.userTraining] >= target) {
            // User's chosen skill is maxed — auto-assign instead
            const sorted = Object.keys(player.skills).sort((a, b) => player.skills[a] - player.skills[b]);
            player.training = sorted[0] === player.userTraining ? sorted[1] : sorted[0];
          } else {
            player.training = player.userTraining;
          }
          continue;
        }
        // Auto-pick the two lowest skills for THIS specific player
        const sorted = Object.keys(player.skills).sort((a, b) => player.skills[a] - player.skills[b]);
        const sk1 = sorted[0];
        const sk2 = sorted[1];
        // Decide which skill to train: if current training reached target, switch to the other
        if (player.training === sk1 && player.skills[sk1] >= target) {
          player.training = sk2;
        } else if (player.training === sk2 && player.skills[sk2] >= target) {
          player.training = sk1;
        } else if (!player.training || (player.training !== sk1 && player.training !== sk2)) {
          // No training set or training a skill that's no longer one of the two lowest — reassign
          player.training = player.skills[sk1] <= player.skills[sk2] ? sk1 : sk2;
        }
        // If both skills are at target, keep training the lower one
        if (player.skills[sk1] >= target && player.skills[sk2] >= target) {
          player.training = player.skills[sk1] <= player.skills[sk2] ? sk1 : sk2;
        }
      }
    }
  }

  // Compute what the assistant coach would auto-assign for a given player (for UI display)
  function getAutoTraining(hpIdx, player) {
    if (!state.assistantCoachData) return null;
    const ac = state.assistantCoachData[hpIdx];
    if (!ac || ac.quality <= 0) return null;
    const target = ac.targetLevel || 99;
    // If user chose a skill but it's at target, show what assistant coach would pick
    if (player.userTraining && player.skills[player.userTraining] >= target) {
      const sorted = Object.keys(player.skills).sort((a, b) => player.skills[a] - player.skills[b]);
      return sorted[0] === player.userTraining ? sorted[1] : sorted[0];
    }
    if (player.userTraining) return player.userTraining;
    // No user training — auto-pick two lowest
    const sorted = Object.keys(player.skills).sort((a, b) => player.skills[a] - player.skills[b]);
    const sk1 = sorted[0];
    const sk2 = sorted[1];
    if (player.training === sk1 && player.skills[sk1] >= target) return sk2;
    if (player.training === sk2 && player.skills[sk2] >= target) return sk1;
    if (!player.training || (player.training !== sk1 && player.training !== sk2)) {
      return player.skills[sk1] <= player.skills[sk2] ? sk1 : sk2;
    }
    if (player.skills[sk1] >= target && player.skills[sk2] >= target) {
      return player.skills[sk1] <= player.skills[sk2] ? sk1 : sk2;
    }
    return player.training;
  }

  // Compute what the youth assistant coach would auto-assign for a given prospect (for UI display)
  function getYouthAutoTraining(hpIdx, player) {
    if (!state.youthAcademyData) return null;
    const ad = state.youthAcademyData[hpIdx];
    if (!ad || (ad.asstCoach || 0) <= 0) return null;
    const target = ad.asstTargetLevel || 99;
    // If user chose a skill but it's at target, show what assistant coach would pick
    if (player.userTraining && player.skills[player.userTraining] >= target) {
      const sorted = Object.keys(player.skills).sort((a, b) => player.skills[a] - player.skills[b]);
      return sorted[0] === player.userTraining ? sorted[1] : sorted[0];
    }
    if (player.userTraining) return player.userTraining;
    // No user training — auto-pick two lowest
    const sorted = Object.keys(player.skills).sort((a, b) => player.skills[a] - player.skills[b]);
    const sk1 = sorted[0];
    const sk2 = sorted[1];
    if (player.training === sk1 && player.skills[sk1] >= target) return sk2;
    if (player.training === sk2 && player.skills[sk2] >= target) return sk1;
    if (!player.training || (player.training !== sk1 && player.training !== sk2)) {
      return player.skills[sk1] <= player.skills[sk2] ? sk1 : sk2;
    }
    if (player.skills[sk1] >= target && player.skills[sk2] >= target) {
      return player.skills[sk1] <= player.skills[sk2] ? sk1 : sk2;
    }
    return player.training;
  }

  function processTraining() {
    // Sync userTraining to training for all human players
    for (const hp of state.humanPlayers) {
      if (hp.sacked) continue;
      const team = state.divisions[hp.division].teams[hp.teamIndex];
      for (const player of team.players) {
        if (player.userTraining) {
          player.training = player.userTraining;
        }
      }
    }

    // Apply assistant coach auto-training (only for players without userTraining)
    applyAssistantCoachLogic();

    for (let dIdx = 0; dIdx < state.divisions.length; dIdx++) {
      const div = state.divisions[dIdx];
      for (const team of div.teams) {
        const coachQ = team.staff.Coach.quality;
        for (const player of team.players) {
          if (player.training && player.injured === 0) {
            const oldSkill = player.skills[player.training];
            // Youth players with high potential train faster
            let trainChance = 0.3 + coachQ * 0.1;
            // Assistant coach bonus for human teams
            if (team.isHuman && state.assistantCoachData) {
              const ac = state.assistantCoachData[team.humanPlayerIndex];
              if (ac && ac.quality > 0) {
                trainChance += MTSM_DATA.ASST_COACH_QUALITY.trainBonus[ac.quality];
              }
            }
            if (state.options.youthAcademy && player.isYouth && player.potential) {
              trainChance += (player.potential - 50) / 200; // e.g. pot 90 adds +0.2
              // Youth potential slowly becomes actual skill with age
              if (player.age <= 21 && player.overall < player.potential) {
                trainChance += 0.1; // extra youth boost
              }
            }
            let improvement = Math.random() < trainChance ? 1 : 0;
            // Rare breakthrough: 7% chance to gain +2 instead of +1 when training succeeds
            if (improvement === 1 && Math.random() < 0.07) {
              improvement = 2;
            }
            const decline = Math.random() < 0.08 ? 1 : 0;
            player.skills[player.training] = Math.min(99, player.skills[player.training] + improvement);
            // Slight decline in untrained skills
            for (const sk of Object.keys(player.skills)) {
              if (sk !== player.training && Math.random() < 0.03) {
                player.skills[sk] = Math.max(1, player.skills[sk] - decline);
              }
            }
            const oldOvr = player.overall;
            player.overall = Math.round(
              MTSM_DATA.calcOverall(player.position, player.skills)
            );
            // Recalculate transfer value based on new overall
            const ageMult = player.age <= 22 ? 1.3 - (player.age - 17) * 0.04 : player.age <= 29 ? 1.0 : 1.0 - (player.age - 29) * 0.07;
            const divMult = [1.5, 1.2, 1.0, 0.8][dIdx] || 1.0;
            const youthMult = player.isYouth ? 0.3 : 1.0;
            player.value = Math.round(player.overall * 10000 * ageMult * divMult * youthMult);
            // Log training news for human teams
            if (team.isHuman && improvement > 0) {
              const breakthroughMsg = improvement === 2 ? ' Breakthrough training week!' : '';
              pushNews({ type: 'TRAINING', text: `${player.name} improved ${player.training} (${oldSkill}→${player.skills[player.training]}).${breakthroughMsg}` });
            }
          }
        }
      }
    }
  }

  function processInjuries() {
    for (const div of state.divisions) {
      for (const team of div.teams) {
        for (const player of team.players) {
          if (player.injured > 0) {
            const physioQ = team.staff.Physio.quality;
            player.injured = Math.max(0, player.injured - 1 - (physioQ >= 3 ? 1 : 0));
            if (team.isHuman && player.injured === 0) {
              pushNews({ type: 'RECOVERY', text: `${player.name} has recovered from injury and is available for selection.` });
            }
          }
        }
      }
    }
  }

  function processRandomEvents() {
    for (const hp of state.humanPlayers) {
      if (hp.sacked) continue;
      const team = state.divisions[hp.division].teams[hp.teamIndex];

      // ~30% chance of an event per week
      if (Math.random() > 0.30) continue;

      const eventTemplate = MTSM_DATA.pick(MTSM_DATA.RANDOM_EVENTS);
      let eventText = '';

      switch (eventTemplate.type) {
        case 'violence': {
          const fine = MTSM_DATA.randInt(eventTemplate.minFine, eventTemplate.maxFine);
          team.balance -= fine;
          recordFinance(team, 'expense', fine, 'Fine (crowd trouble)');
          eventText = eventTemplate.text.replace('{team}', team.name).replace('{amount}', fine.toLocaleString());
          break;
        }
        case 'tv': {
          const bonus = MTSM_DATA.randInt(eventTemplate.minBonus, eventTemplate.maxBonus);
          team.balance += bonus;
          recordFinance(team, 'income', bonus, 'TV bonus');
          eventText = eventTemplate.text.replace('{amount}', bonus.toLocaleString());
          break;
        }
        case 'injury': {
          const available = team.players.filter(p => p.injured === 0);
          if (available.length > 0) {
            const victim = MTSM_DATA.pick(available);
            const weeks = MTSM_DATA.randInt(eventTemplate.minWeeks, eventTemplate.maxWeeks);
            victim.injured = weeks;
            eventText = eventTemplate.text.replace('{player}', victim.name).replace('{weeks}', weeks);
          }
          break;
        }
        case 'grant': {
          const grant = MTSM_DATA.randInt(eventTemplate.minGrant, eventTemplate.maxGrant);
          team.balance += grant;
          recordFinance(team, 'income', grant, 'Council grant');
          eventText = eventTemplate.text.replace('{amount}', grant.toLocaleString());
          break;
        }
        case 'retirement': {
          const oldPlayers = team.players.filter(p => p.age >= 32);
          if (oldPlayers.length > 0 && Math.random() < 0.15) {
            const retiree = MTSM_DATA.pick(oldPlayers);
            eventText = eventTemplate.text.replace('{player}', retiree.name);
            team.players = team.players.filter(p => p.id !== retiree.id);
          }
          break;
        }
        case 'morale': {
          const recentWins = team.form.filter(f => f === 'W').length;
          const idx = Math.max(0, Math.min(4, 4 - recentWins));
          const mood = eventTemplate.moods[idx];
          eventText = eventTemplate.text.replace('{mood}', mood);
          const moraleDelta = (recentWins - 2) * 5;
          for (const p of team.players) {
            p.morale = Math.max(10, Math.min(99, p.morale + moraleDelta));
          }
          break;
        }
        case 'scout_find': {
          if (team.staff.Scout.quality >= 2) {
            const newPlayer = MTSM_DATA.generatePlayer(hp.division);
            newPlayer.askingPrice = Math.round(newPlayer.value * 0.6);
            newPlayer.scouted = true;
            state.transferPool.unshift(newPlayer);
            eventText = eventTemplate.text.replace('{player}', newPlayer.name);
          }
          break;
        }
        case 'sponsor': {
          const bonus = MTSM_DATA.randInt(eventTemplate.minBonus, eventTemplate.maxBonus);
          team.balance += bonus;
          recordFinance(team, 'income', bonus, 'Sponsorship deal');
          eventText = eventTemplate.text.replace('{amount}', bonus.toLocaleString());
          break;
        }
      }

      if (eventText) {
        pushNews({ type: eventTemplate.type.toUpperCase(), text: eventText });
      }
    }
  }

  // ===== TRANSFER ACTIONS =====
  function buyPlayer(playerId, teamObj, bidAmount) {
    const idx = state.transferPool.findIndex(p => p.id === playerId);
    if (idx === -1) return { success: false, msg: 'Player no longer available.' };
    if (teamObj.players.length >= 25) return { success: false, msg: 'Squad full (max 25 players).' };

    const player = state.transferPool[idx];
    const askingPrice = player.askingPrice || player.value;

    // Negotiation mini-game (if enabled and player is expensive enough)
    if (state.options.negotiation && !bidAmount && askingPrice > 10000) {
      return {
        success: false,
        negotiate: true,
        playerId,
        playerName: player.name,
        askingPrice,
        minAccept: Math.round(askingPrice * 0.75),
        msg: `${player.name}'s club wants £${askingPrice.toLocaleString()}. Make an offer!`
      };
    }

    // Handle negotiation bid
    if (state.options.negotiation && bidAmount !== undefined && askingPrice > 10000) {
      const minAccept = Math.round(askingPrice * 0.75);
      if (bidAmount < minAccept) {
        // Counter-offer: club meets halfway
        const counter = Math.round((askingPrice + bidAmount) / 2);
        if (counter <= minAccept) {
          return { success: false, msg: `${player.name}'s club rejected your bid of £${bidAmount.toLocaleString()}. They won't go below £${minAccept.toLocaleString()}.` };
        }
        return {
          success: false,
          counterOffer: true,
          playerId,
          playerName: player.name,
          counterPrice: counter,
          msg: `${player.name}'s club counters with £${counter.toLocaleString()}. Accept or walk away.`
        };
      }
      // Bid accepted
      const finalPrice = Math.min(bidAmount, askingPrice);
      if (teamObj.balance < finalPrice) return { success: false, msg: 'Insufficient funds.' };
      teamObj.balance -= finalPrice;
      recordFinance(teamObj, 'expense', finalPrice, `Transfer: ${player.name}`);
      delete player.askingPrice;
      teamObj.players.push(player);
      state.transferPool.splice(idx, 1);
      if (teamObj.isHuman) pushNews({ type: 'TRANSFER', text: `${player.name} (${player.position}, OVR ${player.overall}) signed for £${finalPrice.toLocaleString()}.` });
      return { success: true, msg: `${player.name} signed for £${finalPrice.toLocaleString()} after negotiations!` };
    }

    // Standard instant buy (original behavior or cheap players)
    if (teamObj.balance < askingPrice) return { success: false, msg: 'Insufficient funds.' };

    const finalPrice = askingPrice;
    teamObj.balance -= finalPrice;
    recordFinance(teamObj, 'expense', finalPrice, `Transfer: ${player.name}`);
    delete player.askingPrice;
    teamObj.players.push(player);
    state.transferPool.splice(idx, 1);
    if (teamObj.isHuman) pushNews({ type: 'TRANSFER', text: `${player.name} (${player.position}, OVR ${player.overall}) signed for £${finalPrice.toLocaleString()}.` });
    return { success: true, msg: `${player.name} signed for £${finalPrice.toLocaleString()}!` };
  }

  function sellPlayer(playerId, teamObj) {
    const idx = teamObj.players.findIndex(p => p.id === playerId);
    if (idx === -1) return { success: false, msg: 'Player not found.' };
    if (teamObj.players.length <= 11) return { success: false, msg: 'Cannot sell — need minimum 11 players.' };

    const player = teamObj.players[idx];
    const salePrice = Math.round(player.value * (0.7 + Math.random() * 0.5));
    teamObj.balance += salePrice;
    recordFinance(teamObj, 'income', salePrice, `Sale: ${player.name}`);
    player.askingPrice = Math.round(salePrice * 1.2);
    if (teamObj.isHuman) pushNews({ type: 'TRANSFER', text: `${player.name} (${player.position}, OVR ${player.overall}) sold for £${salePrice.toLocaleString()}.` });
    state.transferPool.push(player);
    teamObj.players.splice(idx, 1);
    return { success: true, msg: `${player.name} sold for £${salePrice.toLocaleString()}!` };
  }

  // ===== STAFF MANAGEMENT =====
  function upgradeStaff(role, teamObj) {
    const current = teamObj.staff[role];
    if (current.quality >= 4) return { success: false, msg: 'Already at maximum quality.' };
    const newQuality = current.quality + 1;
    const newWage = MTSM_DATA.STAFF_COSTS[newQuality];
    teamObj.staff[role] = { quality: newQuality, wage: newWage };
    if (teamObj.isHuman) pushNews({ type: 'STAFF', text: `${role} upgraded to ${MTSM_DATA.STAFF_QUALITIES[newQuality]}.` });
    return { success: true, msg: `${role} upgraded to ${MTSM_DATA.STAFF_QUALITIES[newQuality]}!` };
  }

  function downgradeStaff(role, teamObj) {
    const current = teamObj.staff[role];
    if (current.quality <= 0) return { success: false, msg: 'Already at minimum quality.' };
    const newQuality = current.quality - 1;
    const newWage = MTSM_DATA.STAFF_COSTS[newQuality];
    teamObj.staff[role] = { quality: newQuality, wage: newWage };
    if (teamObj.isHuman) pushNews({ type: 'STAFF', text: `${role} downgraded to ${MTSM_DATA.STAFF_QUALITIES[newQuality]}.` });
    return { success: true, msg: `${role} downgraded to ${MTSM_DATA.STAFF_QUALITIES[newQuality]}.` };
  }

  // ===== ASSISTANT COACH MANAGEMENT =====
  function upgradeAssistantCoach(hpIdx) {
    if (!state.assistantCoachData) state.assistantCoachData = {};
    if (!state.assistantCoachData[hpIdx]) {
      state.assistantCoachData[hpIdx] = { quality: 0, targetLevel: 99 };
    }
    const ac = state.assistantCoachData[hpIdx];
    if (ac.quality >= 4) return { success: false, msg: 'Already at maximum quality.' };
    ac.quality++;
    const levelName = MTSM_DATA.ASST_COACH_QUALITY.levels[ac.quality];
    pushNews({ type: 'STAFF', text: `Assistant Coach ${ac.quality === 1 ? 'hired' : 'upgraded'} to ${levelName}.` });
    return { success: true, msg: `Assistant Coach ${ac.quality === 1 ? 'hired' : 'upgraded'} to ${levelName}!` };
  }

  function downgradeAssistantCoach(hpIdx) {
    if (!state.assistantCoachData || !state.assistantCoachData[hpIdx]) return { success: false, msg: 'No assistant coach.' };
    const ac = state.assistantCoachData[hpIdx];
    if (ac.quality <= 0) return { success: false, msg: 'No assistant coach to dismiss.' };
    ac.quality--;
    if (ac.quality === 0) {
      ac.targetLevel = 99;
      pushNews({ type: 'STAFF', text: 'Assistant Coach dismissed.' });
      return { success: true, msg: 'Assistant Coach dismissed.' };
    }
    const levelName = MTSM_DATA.ASST_COACH_QUALITY.levels[ac.quality];
    pushNews({ type: 'STAFF', text: `Assistant Coach downgraded to ${levelName}.` });
    return { success: true, msg: `Assistant Coach downgraded to ${levelName}.` };
  }

  function setAssistantCoachConfig(hpIdx, targetLevel) {
    if (!state.assistantCoachData || !state.assistantCoachData[hpIdx]) return { success: false, msg: 'No assistant coach.' };
    const ac = state.assistantCoachData[hpIdx];
    if (ac.quality <= 0) return { success: false, msg: 'Hire an assistant coach first.' };
    ac.targetLevel = (targetLevel && targetLevel > 0 && targetLevel <= 99) ? targetLevel : 99;
    return { success: true, msg: 'Assistant Coach target level updated.' };
  }

  function upgradeYouthAssistantCoach(hpIdx) {
    if (!state.youthAcademyData || !state.youthAcademyData[hpIdx]) return { success: false, msg: 'No youth academy.' };
    const ad = state.youthAcademyData[hpIdx];
    if ((ad.asstCoach || 0) >= 4) return { success: false, msg: 'Already at maximum quality.' };
    ad.asstCoach = (ad.asstCoach || 0) + 1;
    const levelName = MTSM_DATA.ASST_COACH_QUALITY.levels[ad.asstCoach];
    pushNews({ type: 'ACADEMY', text: `Youth Assistant Coach ${ad.asstCoach === 1 ? 'hired' : 'upgraded'} to ${levelName}.` });
    return { success: true, msg: `Youth Assistant Coach ${ad.asstCoach === 1 ? 'hired' : 'upgraded'} to ${levelName}!` };
  }

  function downgradeYouthAssistantCoach(hpIdx) {
    if (!state.youthAcademyData || !state.youthAcademyData[hpIdx]) return { success: false, msg: 'No youth academy.' };
    const ad = state.youthAcademyData[hpIdx];
    if ((ad.asstCoach || 0) <= 0) return { success: false, msg: 'No youth assistant coach to dismiss.' };
    ad.asstCoach--;
    if (ad.asstCoach === 0) {
      ad.asstTargetLevel = 99;
      pushNews({ type: 'ACADEMY', text: 'Youth Assistant Coach dismissed.' });
      return { success: true, msg: 'Youth Assistant Coach dismissed.' };
    }
    const levelName = MTSM_DATA.ASST_COACH_QUALITY.levels[ad.asstCoach];
    pushNews({ type: 'ACADEMY', text: `Youth Assistant Coach downgraded to ${levelName}.` });
    return { success: true, msg: `Youth Assistant Coach downgraded to ${levelName}.` };
  }

  function setYouthAssistantCoachConfig(hpIdx, targetLevel) {
    if (!state.youthAcademyData || !state.youthAcademyData[hpIdx]) return { success: false, msg: 'No youth academy.' };
    const ad = state.youthAcademyData[hpIdx];
    if ((ad.asstCoach || 0) <= 0) return { success: false, msg: 'Hire a youth assistant coach first.' };
    ad.asstTargetLevel = (targetLevel && targetLevel > 0 && targetLevel <= 99) ? targetLevel : 99;
    return { success: true, msg: 'Youth Assistant Coach target level updated.' };
  }

  // ===== GROUND MANAGEMENT =====
  function upgradeGround(aspect, teamObj) {
    const upgrade = MTSM_DATA.GROUND_UPGRADES[aspect];
    const currentLevel = teamObj.ground[aspect];
    if (currentLevel >= upgrade.levels.length - 1) return { success: false, msg: 'Already at maximum.' };
    const cost = upgrade.costs[currentLevel + 1];
    if (teamObj.balance < cost) return { success: false, msg: `Insufficient funds. Need £${cost.toLocaleString()}.` };
    teamObj.balance -= cost;
    recordFinance(teamObj, 'expense', cost, `Ground upgrade: ${aspect}`);
    teamObj.ground[aspect]++;
    if (teamObj.isHuman) pushNews({ type: 'GROUND', text: `${aspect.charAt(0).toUpperCase() + aspect.slice(1)} upgraded for £${cost.toLocaleString()}.` });
    return { success: true, msg: `${aspect.charAt(0).toUpperCase() + aspect.slice(1)} upgraded! Cost: £${cost.toLocaleString()}` };
  }

  // ===== END OF SEASON =====
  function processEndOfSeason() {
    const promotions = [];
    const relegations = [];
    const champion = [];

    for (let d = 0; d < 4; d++) {
      const div = state.divisions[d];
      // Sort teams by points, then goal difference, then goals scored
      const sorted = [...div.teams].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
        return b.goalsFor - a.goalsFor;
      });

      // Division 1 champion
      if (d === 0) {
        champion.push({ team: sorted[0].name, division: d });
      }

      // Top 2 promoted (except Division 1)
      if (d > 0) {
        promotions.push({ team: sorted[0], fromDiv: d, toDiv: d - 1 });
        promotions.push({ team: sorted[1], fromDiv: d, toDiv: d - 1 });
      }

      // Bottom 2 relegated (except Division 4)
      if (d < 3) {
        relegations.push({ team: sorted[14], fromDiv: d, toDiv: d + 1 });
        relegations.push({ team: sorted[15], fromDiv: d, toDiv: d + 1 });
      }

      // Division 4 bottom team gets "League Joker" trophy
      if (d === 3) {
        const lastTeam = sorted[15];
        pushNews({
          type: 'TROPHY',
          text: `${lastTeam.name} wins the legendary "League Joker" trophy for finishing bottom of Division 4!`
        });
      }
    }

    // Snapshot each human player's division/teamIndex BEFORE promotions change them
    const hpSnapshot = state.humanPlayers.map((hp, i) => {
      if (hp.sacked) return null;
      const team = state.divisions[hp.division].teams[hp.teamIndex];
      const table = getLeagueTable(hp.division);
      const pos = table.findIndex(t => t.name === team.name) + 1;
      return { division: hp.division, teamIndex: hp.teamIndex, team, pos };
    });

    // Record AI manager season history BEFORE promotions change divisions
    _recordAIManagerSeasonHistory(promotions, relegations);

    // Execute promotions and relegations
    for (const promo of promotions) {
      moveTeamBetweenDivisions(promo.team, promo.fromDiv, promo.toDiv);
      pushNews({
        type: 'PROMOTION',
        text: `${promo.team.name} promoted from Division ${promo.fromDiv + 1} to Division ${promo.toDiv + 1}!`
      });
    }

    for (const releg of relegations) {
      moveTeamBetweenDivisions(releg.team, releg.fromDiv, releg.toDiv);
      pushNews({
        type: 'RELEGATION',
        text: `${releg.team.name} relegated from Division ${releg.fromDiv + 1} to Division ${releg.toDiv + 1}!`
      });
    }

    // Age players and retire old ones
    for (let dIdx = 0; dIdx < state.divisions.length; dIdx++) {
      const div = state.divisions[dIdx];
      for (const team of div.teams) {
        for (const player of team.players) {
          player.age++;
          // Decline for older players
          if (player.age > 30) {
            for (const sk of Object.keys(player.skills)) {
              if (Math.random() < 0.3) {
                player.skills[sk] = Math.max(1, player.skills[sk] - MTSM_DATA.randInt(1, 3));
              }
            }
            player.overall = Math.round(
              MTSM_DATA.calcOverall(player.position, player.skills)
            );
          }
          // After a season on the senior squad, youth players graduate to normal valuation
          if (player.isYouth) {
            if (team.isHuman) {
              pushNews({ type: 'ACADEMY', text: `${player.name} (${player.position}, Ovr ${player.overall}) has graduated from youth status and is now a full senior squad member!` });
            }
            delete player.isYouth;
          }
          // Recalculate transfer value each season (after youth graduation so multiplier is correct)
          const ageMult = player.age <= 22 ? 1.3 - (player.age - 17) * 0.04 : player.age <= 29 ? 1.0 : 1.0 - (player.age - 29) * 0.07;
          const divMult = [1.5, 1.2, 1.0, 0.8][dIdx] || 1.0;
          const youthMult = player.isYouth ? 0.3 : 1.0;
          player.value = Math.round(player.overall * 10000 * ageMult * divMult * youthMult);
        }
        // Auto-retire very old players
        const retired = team.players.filter(p => p.age >= 37);
        for (const r of retired) {
          pushNews({ type: 'RETIREMENT', text: `${r.name} (${team.name}) retires at age ${r.age}.` });
        }
        team.players = team.players.filter(p => p.age < 37);

        // Auto-fill if team is short
        while (team.players.length < 14) {
          const divIdx = state.divisions.indexOf(div);
          team.players.push(MTSM_DATA.generatePlayer(divIdx));
        }
      }
    }

    // Record club history for each human player using pre-promotion snapshot
    for (let i = 0; i < state.humanPlayers.length; i++) {
      const hp = state.humanPlayers[i];
      if (hp.sacked || !hpSnapshot[i]) continue;
      const snap = hpSnapshot[i];
      const team = snap.team;
      const origDiv = snap.division;
      const pos = snap.pos;

      // Collect trophies won this season (using original division before promotion/relegation)
      const trophies = [];
      // League champion (Division 1, position 1)
      if (origDiv === 0 && pos === 1) {
        trophies.push('League Champion');
      }
      // Division champion (top of any division)
      if (pos === 1 && origDiv > 0) {
        trophies.push(`Division ${origDiv + 1} Champion`);
      }
      // Cup trophies
      if (state.options.cupPrizeMoney) {
        if (state.cup && state.cup[origDiv] && state.cup[origDiv].winner === team.name) {
          trophies.push(`Division ${origDiv + 1} Cup`);
        }
        if (state.nationalCup && state.nationalCup.winner === team.name) {
          trophies.push('National Cup');
        }
        if (state.leagueTrophy && state.leagueTrophy.winner === team.name) {
          trophies.push('League Trophy');
        }
      }
      // League Joker trophy
      if (origDiv === 3 && pos === 16) {
        trophies.push('League Joker');
      }

      if (!state.clubHistory) state.clubHistory = {};
      if (!state.clubHistory[i]) state.clubHistory[i] = [];

      // Compute streaks and records from match log
      const log = (state.matchLog && state.matchLog[i]) || [];
      let winStreak = 0, maxWinStreak = 0;
      let loseStreak = 0, maxLoseStreak = 0;
      let unbeatenRun = 0, maxUnbeatenRun = 0;
      let winlessRun = 0, maxWinlessRun = 0;
      let cleanSheets = 0;
      let biggestWin = null; // { goalsFor, goalsAgainst, opponent, isHome }
      let biggestLoss = null;
      let highestScoring = null; // most total goals in a match

      for (const m of log) {
        // Win streak
        if (m.outcome === 'W') { winStreak++; } else { winStreak = 0; }
        if (winStreak > maxWinStreak) maxWinStreak = winStreak;

        // Lose streak
        if (m.outcome === 'L') { loseStreak++; } else { loseStreak = 0; }
        if (loseStreak > maxLoseStreak) maxLoseStreak = loseStreak;

        // Unbeaten run
        if (m.outcome !== 'L') { unbeatenRun++; } else { unbeatenRun = 0; }
        if (unbeatenRun > maxUnbeatenRun) maxUnbeatenRun = unbeatenRun;

        // Winless run
        if (m.outcome !== 'W') { winlessRun++; } else { winlessRun = 0; }
        if (winlessRun > maxWinlessRun) maxWinlessRun = winlessRun;

        // Clean sheets
        if (m.goalsAgainst === 0) cleanSheets++;

        // Biggest win (by goal difference, then by goals scored)
        const diff = m.goalsFor - m.goalsAgainst;
        if (diff > 0 && (!biggestWin || diff > biggestWin.diff || (diff === biggestWin.diff && m.goalsFor > biggestWin.goalsFor))) {
          biggestWin = { goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst, opponent: m.opponent, isHome: m.isHome, diff };
        }

        // Biggest loss
        if (diff < 0 && (!biggestLoss || diff < biggestLoss.diff || (diff === biggestLoss.diff && m.goalsAgainst > biggestLoss.goalsAgainst))) {
          biggestLoss = { goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst, opponent: m.opponent, isHome: m.isHome, diff };
        }

        // Highest scoring match
        const totalGoals = m.goalsFor + m.goalsAgainst;
        if (!highestScoring || totalGoals > highestScoring.total) {
          highestScoring = { goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst, opponent: m.opponent, isHome: m.isHome, total: totalGoals };
        }
      }

      state.clubHistory[i].push({
        season: state.season,
        club: team.name,
        division: origDiv + 1,
        position: pos,
        played: team.played,
        won: team.won,
        drawn: team.drawn,
        lost: team.lost,
        goalsFor: team.goalsFor,
        goalsAgainst: team.goalsAgainst,
        points: team.points,
        trophies,
        records: {
          winStreak: maxWinStreak,
          loseStreak: maxLoseStreak,
          unbeatenRun: maxUnbeatenRun,
          winlessRun: maxWinlessRun,
          cleanSheets,
          biggestWin,
          biggestLoss,
          highestScoring
        }
      });

      // Reset match log for next season
      if (state.matchLog) state.matchLog[i] = [];
    }

    // Reset season stats
    for (const div of state.divisions) {
      div.currentRound = 0;
      div.fixtures = MTSM_DATA.generateFixtures(div.teams.map(t => t.name));
      for (const team of div.teams) {
        team.points = 0;
        team.won = 0;
        team.drawn = 0;
        team.lost = 0;
        team.goalsFor = 0;
        team.goalsAgainst = 0;
        team.played = 0;
        team.form = [];
        team.cupRunWins = 0;
      }
    }

    // Add new players to transfer market
    const newPlayers = MTSM_DATA.generateTransferPool(50);
    state.transferPool = [...state.transferPool.slice(-150), ...newPlayers];

    state.season++;
    state.week = 1;
    state.seasonOver = false;
    state.transferMarketRefreshedWeek = 0;

    // Reset AI manager seasonal counters
    _resetAIManagerSeasonData();

    // Reset cup for new season
    if (state.options.cupPrizeMoney) {
      state.cup = generateCupBrackets(state.divisions);
      state.nationalCup = generateNationalCupBracket(state.divisions);
      state.leagueTrophy = generateNationalCupBracket(state.divisions);
    }

    // Refresh youth academy — fill up to capacity, keeping existing trained prospects
    if (state.options.youthAcademy) {
      for (let i = 0; i < state.humanPlayers.length; i++) {
        if (!state.humanPlayers[i].sacked) {
          const ad = (state.youthAcademyData && state.youthAcademyData[i]) || { quality: 0 };
          const maxCap = MTSM_DATA.ACADEMY_QUALITY.maxCapacity[ad.quality];
          const currentPool = state.youthAcademy[i] || [];
          const slotsAvailable = Math.max(0, maxCap - currentPool.length);
          const newCount = Math.min(MTSM_DATA.ACADEMY_QUALITY.prospectCount[ad.quality], slotsAvailable);
          const skillBonus = MTSM_DATA.ACADEMY_QUALITY.baseSkillBonus[ad.quality];
          if (newCount > 0) {
            state.youthAcademy[i] = currentPool.concat(generateYouthPlayers(newCount, skillBonus));
          }
        }
      }
    }

    return { promotions, relegations, champion };
  }

  function moveTeamBetweenDivisions(team, fromDiv, toDiv) {
    const fromDivision = state.divisions[fromDiv];
    const toDivision = state.divisions[toDiv];

    const fromIdx = fromDivision.teams.indexOf(team);
    if (fromIdx === -1) return;

    // Move team between divisions
    fromDivision.teams.splice(fromIdx, 1);
    toDivision.teams.push(team);

    // Update all human player tracking to reflect new division positions
    for (let i = 0; i < state.humanPlayers.length; i++) {
      const hp = state.humanPlayers[i];
      if (hp.sacked) continue;
      // Find this human player's team across all divisions
      for (let d = 0; d < state.divisions.length; d++) {
        const idx = state.divisions[d].teams.findIndex(
          t => t.isHuman && t.humanPlayerIndex === i
        );
        if (idx !== -1) {
          hp.division = d;
          hp.teamIndex = idx;
          break;
        }
      }
    }
  }

  // ===== LEAGUE TABLE =====
  function getLeagueTable(divisionIndex) {
    const div = state.divisions[divisionIndex];
    return [...div.teams].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.goalsFor - a.goalsFor;
    });
  }

  function getNextFixtures(divisionIndex) {
    const div = state.divisions[divisionIndex];
    if (div.currentRound >= div.fixtures.length) return [];
    const round = div.fixtures[div.currentRound];
    return round.map(([h, a]) => ({
      home: div.teams[h].name,
      away: div.teams[a].name,
      homeIsHuman: div.teams[h].isHuman,
      awayIsHuman: div.teams[a].isHuman
    }));
  }

  // ===== CUP SYSTEM =====
  const CUP_PRIZE_MONEY = {
    // [round1, round2, QF, SF, Final, Winner]
    0: [5000, 10000, 20000, 40000, 80000, 150000],   // Div 1
    1: [3000, 6000, 12000, 25000, 50000, 100000],    // Div 2
    2: [2000, 4000, 8000, 15000, 30000, 60000],      // Div 3
    3: [1000, 2000, 4000, 8000, 15000, 30000]        // Div 4
  };

  // National cup prize money: [R1, R2, R3, QF, SF, Final, Winner]
  const NATIONAL_CUP_PRIZE_MONEY = [2000, 5000, 10000, 25000, 50000, 100000, 250000];
  const LEAGUE_TROPHY_PRIZE_MONEY = [1500, 3000, 7000, 15000, 35000, 75000, 175000];

  function generateCupBrackets(divisions) {
    const cup = {};
    for (let d = 0; d < 4; d++) {
      const teams = [...divisions[d].teams].map(t => t.name);
      // Shuffle for draw
      for (let i = teams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [teams[i], teams[j]] = [teams[j], teams[i]];
      }
      cup[d] = {
        teams,
        rounds: [{ matches: [], results: [] }],
        currentRound: 0,
        eliminated: [],
        finished: false,
        winner: null
      };
      // First round: 16 teams -> 8 matches
      const matches = [];
      for (let i = 0; i < teams.length; i += 2) {
        matches.push({ home: teams[i], away: teams[i + 1], played: false });
      }
      cup[d].rounds[0].matches = matches;
    }
    return cup;
  }

  function processCupRound() {
    if (!state.cup) return;

    for (let d = 0; d < 4; d++) {
      const divCup = state.cup[d];
      if (divCup.finished) continue;

      const round = divCup.rounds[divCup.currentRound];
      if (!round) continue;

      // Only play one match per match day (every 3 league weeks)
      if (state.week % 3 !== 0) continue;

      const unplayed = round.matches.filter(m => !m.played);
      if (unplayed.length === 0) {
        // Advance to next round
        const winners = round.results.map(r => r.winner);
        if (winners.length <= 1) {
          // Cup is over
          divCup.finished = true;
          if (winners.length === 1) {
            divCup.winner = winners[0];
            pushNews({ type: 'CUP', text: `${winners[0]} wins the Division ${d + 1} Cup!` });
            // Award winner prize
            const winnerTeam = state.divisions[d].teams.find(t => t.name === winners[0]);
            if (winnerTeam) {
              const prize = CUP_PRIZE_MONEY[d][5];
              winnerTeam.balance += prize;
              recordFinance(winnerTeam, 'income', prize, `Div ${d + 1} Cup winner bonus`);
              pushNews({ type: 'CUP', text: `${winners[0]} receives \u00a3${prize.toLocaleString()} cup winner prize money!` });
            }
          }
          continue;
        }
        // Build next round
        const nextMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
          if (i + 1 < winners.length) {
            nextMatches.push({ home: winners[i], away: winners[i + 1], played: false });
          } else {
            // Bye
            nextMatches.push({ home: winners[i], away: null, played: true });
            // Auto-advance
          }
        }
        divCup.currentRound++;
        divCup.rounds.push({ matches: nextMatches, results: [] });
        continue;
      }

      // Play all unplayed matches in this round
      const cupResults = [];
      for (const match of unplayed) {
        if (!match.away) {
          // Bye
          match.played = true;
          round.results.push({ home: match.home, away: 'BYE', homeGoals: 0, awayGoals: 0, winner: match.home });
          continue;
        }
        const homeTeam = state.divisions[d].teams.find(t => t.name === match.home);
        const awayTeam = state.divisions[d].teams.find(t => t.name === match.away);
        if (!homeTeam || !awayTeam) continue;

        let result = simulateMatch(homeTeam, awayTeam, {
          isCup: true,
          divisionIndex: d,
          awayDivisionIndex: d
        });
        // Cup match: if draw, away goals / extra time (just replay with slight home boost)
        if (result.homeGoals === result.awayGoals) {
          result.homeGoals += Math.random() < 0.55 ? 1 : 0;
          result.awayGoals += Math.random() < 0.45 ? 1 : 0;
          if (result.homeGoals === result.awayGoals) result.homeGoals++; // force a result
        }

        // Cup attendance & gate income (50/50 split)
        const attendance = calculateAttendance(homeTeam, d);
        const ticketPrice = d === 0 ? 25 : d === 1 ? 18 : d === 2 ? 12 : 8;
        const gateIncome = attendance * ticketPrice;
        const homeShare = Math.floor(gateIncome * 0.5);
        const awayShare = Math.floor(gateIncome * 0.5);
        homeTeam.balance += homeShare;
        awayTeam.balance += awayShare;
        recordFinance(homeTeam, 'income', homeShare, `Div ${d + 1} Cup gate (50%)`);
        recordFinance(awayTeam, 'income', awayShare, `Div ${d + 1} Cup gate (50%)`);

        const winner = result.homeGoals > result.awayGoals ? match.home : match.away;
        const loser = winner === match.home ? match.away : match.home;
        match.played = true;

        // Track cup run wins for momentum
        const winnerTeamDiv = state.divisions[d].teams.find(t => t.name === winner);
        if (winnerTeamDiv) {
          winnerTeamDiv.cupRunWins = (winnerTeamDiv.cupRunWins || 0) + 1;
        }

        const cupResult = {
          home: match.home,
          away: match.away,
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
          attendance,
          gateIncome,
          winner,
          isHumanMatch: (homeTeam.isHuman || awayTeam.isHuman)
        };
        round.results.push(cupResult);
        cupResults.push(cupResult);

        divCup.eliminated.push(loser);

        // Prize money for advancing
        const roundIdx = Math.min(divCup.currentRound, 5);
        const prize = CUP_PRIZE_MONEY[d][roundIdx];
        const winnerTeam = state.divisions[d].teams.find(t => t.name === winner);
        if (winnerTeam) {
          winnerTeam.balance += prize;
          recordFinance(winnerTeam, 'income', prize, `Div ${d + 1} Cup prize money`);
        }

        if (homeTeam.isHuman || awayTeam.isHuman) {
          const cupRoundNames = ['Round 1', 'Round 2', 'Quarter-Final', 'Semi-Final', 'FINAL'];
          const roundName = cupRoundNames[Math.min(divCup.currentRound, 4)];
          pushNews({
            type: 'CUP',
            text: `Cup ${roundName}: ${match.home} ${result.homeGoals}-${result.awayGoals} ${match.away}. ${winner} advances! (\u00a3${prize.toLocaleString()} prize)`
          });
        }
      }

      // Add cup results to matchResults for display
      if (cupResults.length > 0) {
        state.matchResults.push({ division: d, results: cupResults, cupName: `Division ${d + 1} Cup` });
      }
    }
  }

  // ===== NATIONAL CUP SYSTEM =====
  // Helper: find a team object by name across all divisions
  function findTeamByName(name) {
    for (const div of state.divisions) {
      const team = div.teams.find(t => t.name === name);
      if (team) return team;
    }
    return null;
  }

  // Helper: find the division index for a team by name
  function findTeamDivisionIndex(name) {
    for (let i = 0; i < state.divisions.length; i++) {
      if (state.divisions[i].teams.find(t => t.name === name)) return i;
    }
    return 3; // fallback to lowest division
  }

  function generateNationalCupBracket(divisions) {
    // All 64 teams from all divisions, shuffled
    const teams = [];
    for (const div of divisions) {
      for (const t of div.teams) {
        teams.push(t.name);
      }
    }
    // Shuffle
    for (let i = teams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teams[i], teams[j]] = [teams[j], teams[i]];
    }
    const bracket = {
      teams,
      rounds: [{ matches: [], results: [] }],
      currentRound: 0,
      eliminated: [],
      finished: false,
      winner: null
    };
    // First round: 64 teams -> 32 matches
    const matches = [];
    for (let i = 0; i < teams.length; i += 2) {
      matches.push({ home: teams[i], away: teams[i + 1], played: false });
    }
    bracket.rounds[0].matches = matches;
    return bracket;
  }

  function processNationalCupRound(cupKey, prizeMoney, cupName) {
    const cup = state[cupKey];
    if (!cup || cup.finished) return;

    // Advance round if current round is complete, then play new round's matches
    let round = cup.rounds[cup.currentRound];
    if (!round) return;

    let unplayed = round.matches.filter(m => !m.played);
    if (unplayed.length === 0) {
      // Advance to next round
      const winners = round.results.map(r => r.winner);
      if (winners.length <= 1) {
        cup.finished = true;
        if (winners.length === 1) {
          cup.winner = winners[0];
          pushNews({ type: 'CUP', text: `${winners[0]} wins the ${cupName}!` });
          const winnerTeam = findTeamByName(winners[0]);
          if (winnerTeam) {
            const prize = prizeMoney[6];
            winnerTeam.balance += prize;
            recordFinance(winnerTeam, 'income', prize, `${cupName} winner bonus`);
            pushNews({ type: 'CUP', text: `${winners[0]} receives \u00a3${prize.toLocaleString()} ${cupName} winner prize!` });
          }
        }
        return;
      }
      const nextMatches = [];
      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          nextMatches.push({ home: winners[i], away: winners[i + 1], played: false });
        } else {
          nextMatches.push({ home: winners[i], away: null, played: true });
        }
      }
      cup.currentRound++;
      cup.rounds.push({ matches: nextMatches, results: [] });
      // Continue to play the new round's matches in the same week
      round = cup.rounds[cup.currentRound];
      unplayed = round.matches.filter(m => !m.played);
      if (unplayed.length === 0) return;
    }

    // Play all unplayed matches
    const cupResults = [];
    for (const match of unplayed) {
      if (!match.away) {
        match.played = true;
        round.results.push({ home: match.home, away: 'BYE', homeGoals: 0, awayGoals: 0, winner: match.home });
        continue;
      }
      const homeTeam = findTeamByName(match.home);
      const awayTeam = findTeamByName(match.away);
      if (!homeTeam || !awayTeam) continue;

      const homeDivIdxCup = findTeamDivisionIndex(match.home);
      const awayDivIdxCup = findTeamDivisionIndex(match.away);
      let result = simulateMatch(homeTeam, awayTeam, {
        isCup: true,
        divisionIndex: homeDivIdxCup,
        awayDivisionIndex: awayDivIdxCup
      });
      // Knockout: no draws allowed
      if (result.homeGoals === result.awayGoals) {
        result.homeGoals += Math.random() < 0.55 ? 1 : 0;
        result.awayGoals += Math.random() < 0.45 ? 1 : 0;
        if (result.homeGoals === result.awayGoals) result.homeGoals++;
      }

      // Cup attendance & gate income (50/50 split)
      const homeDivIdx = findTeamDivisionIndex(match.home);
      const attendance = calculateAttendance(homeTeam, homeDivIdx);
      const ticketPrice = homeDivIdx === 0 ? 25 : homeDivIdx === 1 ? 18 : homeDivIdx === 2 ? 12 : 8;
      const gateIncome = attendance * ticketPrice;
      const homeShare = Math.floor(gateIncome * 0.5);
      const awayShare = Math.floor(gateIncome * 0.5);
      homeTeam.balance += homeShare;
      awayTeam.balance += awayShare;
      recordFinance(homeTeam, 'income', homeShare, `${cupName} gate (50%)`);
      recordFinance(awayTeam, 'income', awayShare, `${cupName} gate (50%)`);

      const winner = result.homeGoals > result.awayGoals ? match.home : match.away;
      const loser = winner === match.home ? match.away : match.home;
      match.played = true;
      const awayDivIdx = findTeamDivisionIndex(match.away);
      const cupResult = {
        home: match.home,
        away: match.away,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        homeDivision: homeDivIdx + 1,
        awayDivision: awayDivIdx + 1,
        attendance,
        gateIncome,
        winner,
        isHumanMatch: (homeTeam.isHuman || awayTeam.isHuman)
      };
      round.results.push(cupResult);
      cupResults.push(cupResult);

      cup.eliminated.push(loser);

      // Prize money
      const roundIdx = Math.min(cup.currentRound, 6);
      const prize = prizeMoney[roundIdx];
      const winnerTeam = findTeamByName(winner);
      if (winnerTeam) {
        winnerTeam.balance += prize;
        recordFinance(winnerTeam, 'income', prize, `${cupName} prize money`);
      }

      if (homeTeam.isHuman || awayTeam.isHuman) {
        const roundNames = ['Round 1', 'Round 2', 'Round 3', 'Quarter-Final', 'Semi-Final', 'FINAL'];
        const roundName = roundNames[Math.min(cup.currentRound, 5)];
        pushNews({
          type: 'CUP',
          text: `${cupName} ${roundName}: ${match.home} ${result.homeGoals}-${result.awayGoals} ${match.away}. ${winner} advances! (\u00a3${prize.toLocaleString()} prize)`
        });
      }
    }

    // Add cup results to matchResults for display
    if (cupResults.length > 0) {
      state.matchResults.push({ division: -1, results: cupResults, cupName });
    }

    // Check if the tournament is now complete after playing matches
    const playedRound = cup.rounds[cup.currentRound];
    const remaining = playedRound.matches.filter(m => !m.played);
    if (remaining.length === 0) {
      const winners = playedRound.results.map(r => r.winner);
      if (winners.length <= 1) {
        cup.finished = true;
        if (winners.length === 1) {
          cup.winner = winners[0];
          pushNews({ type: 'CUP', text: `${winners[0]} wins the ${cupName}!` });
          const winnerTeam = findTeamByName(winners[0]);
          if (winnerTeam) {
            const prize = prizeMoney[6];
            winnerTeam.balance += prize;
            recordFinance(winnerTeam, 'income', prize, `${cupName} winner bonus`);
            pushNews({ type: 'CUP', text: `${winners[0]} receives \u00a3${prize.toLocaleString()} ${cupName} winner prize!` });
          }
        }
      }
    }
  }

  // ===== YOUTH ACADEMY =====
  function generateYouthPlayers(count, skillBonus) {
    const bonus = skillBonus || 0;
    const players = [];
    for (let i = 0; i < count; i++) {
      const pos = MTSM_DATA.pick(['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD']);
      const age = MTSM_DATA.randInt(16, 18);
      const baseSkill = MTSM_DATA.randInt(15, 35) + bonus;
      const playerSkills = MTSM_DATA.getSkillsForPosition(pos);
      const skills = {};
      for (const sk of playerSkills) {
        let val = baseSkill + MTSM_DATA.randInt(-8, 8);
        if (pos === 'GK' && (sk === 'Handling' || sk === 'Tackling')) val += 5;
        if (pos === 'DEF' && (sk === 'Tackling' || sk === 'Heading')) val += 5;
        if (pos === 'MID' && (sk === 'Passing' || sk === 'Stamina')) val += 5;
        if (pos === 'FWD' && (sk === 'Shooting' || sk === 'Pace')) val += 5;
        skills[sk] = Math.max(1, Math.min(99, val));
      }
      const overall = MTSM_DATA.calcOverall(pos, skills);
      const potential = MTSM_DATA.randInt(55, 90); // how good they can become
      const wage = Math.round((overall * 20 + MTSM_DATA.randInt(0, 200)) / 10) * 10;
      // Youth players cost 30% of senior value (unproven but have potential)
      const ageMult = age <= 22 ? 1.3 - (age - 17) * 0.04 : 1.0;
      const value = Math.round(overall * 10000 * ageMult * 0.3);

      players.push({
        id: Math.random().toString(36).substr(2, 9),
        name: MTSM_DATA.pick(MTSM_DATA.FIRST_NAMES) + ' ' + MTSM_DATA.pick(MTSM_DATA.LAST_NAMES),
        position: pos,
        age,
        skills,
        overall,
        potential,
        wage,
        value,
        injured: 0,
        morale: MTSM_DATA.randInt(60, 90),
        training: null,
        isYouth: true
      });
    }
    return players;
  }

  function signYouthPlayer(playerIdx, hpIdx) {
    if (!state.youthAcademy || !state.youthAcademy[hpIdx]) return { success: false, msg: 'No academy available.' };
    const academy = state.youthAcademy[hpIdx];
    if (playerIdx < 0 || playerIdx >= academy.length) return { success: false, msg: 'Invalid player.' };

    const hp = state.humanPlayers[hpIdx];
    const team = state.divisions[hp.division].teams[hp.teamIndex];
    if (team.players.length >= 25) return { success: false, msg: 'Squad full (max 25 players).' };

    const player = academy[playerIdx];
    const signingFee = player.value;
    if (team.balance < signingFee) return { success: false, msg: `Insufficient funds. Need \u00a3${signingFee.toLocaleString()}.` };

    team.balance -= signingFee;
    team.players.push(player);
    academy.splice(playerIdx, 1);
    recordFinance(team, 'expense', signingFee, `Youth signing: ${player.name}`);
    pushNews({ type: 'ACADEMY', text: `Youth prospect ${player.name} (${player.position}, Ovr ${player.overall}, Pot ${player.potential}) promoted to the first team for ${String.fromCharCode(163)}${signingFee.toLocaleString()}!` });
    return { success: true, msg: `Youth prospect ${player.name} signed for \u00a3${signingFee.toLocaleString()}!` };
  }

  function releaseYouthPlayer(playerIdx, hpIdx) {
    if (!state.youthAcademy || !state.youthAcademy[hpIdx]) return { success: false, msg: 'No academy available.' };
    const academy = state.youthAcademy[hpIdx];
    if (playerIdx < 0 || playerIdx >= academy.length) return { success: false, msg: 'Invalid player.' };
    const player = academy[playerIdx];
    academy.splice(playerIdx, 1);
    return { success: true, msg: `${player.name} released from the academy.` };
  }

  function upgradeAcademyQuality(hpIdx) {
    if (!state.youthAcademyData || !state.youthAcademyData[hpIdx]) return { success: false, msg: 'No academy data.' };
    const ad = state.youthAcademyData[hpIdx];
    if (ad.quality >= 4) return { success: false, msg: 'Academy already at maximum quality.' };
    const newLevel = ad.quality + 1;
    const cost = MTSM_DATA.ACADEMY_QUALITY.costs[newLevel];
    const hp = state.humanPlayers[hpIdx];
    const team = state.divisions[hp.division].teams[hp.teamIndex];
    if (team.balance < cost) return { success: false, msg: `Insufficient funds. Need £${cost.toLocaleString()}.` };
    team.balance -= cost;
    recordFinance(team, 'expense', cost, `Academy upgrade: ${MTSM_DATA.ACADEMY_QUALITY.levels[newLevel]}`);
    ad.quality = newLevel;
    pushNews({ type: 'ACADEMY', text: `Youth academy upgraded to ${MTSM_DATA.ACADEMY_QUALITY.levels[newLevel]}!` });
    return { success: true, msg: `Academy upgraded to ${MTSM_DATA.ACADEMY_QUALITY.levels[newLevel]}! Cost: £${cost.toLocaleString()}` };
  }

  function upgradeYouthCoach(hpIdx) {
    if (!state.youthAcademyData || !state.youthAcademyData[hpIdx]) return { success: false, msg: 'No academy data.' };
    const ad = state.youthAcademyData[hpIdx];
    if (ad.youthCoach >= 4) return { success: false, msg: 'Youth coach already at maximum quality.' };
    ad.youthCoach++;
    pushNews({ type: 'ACADEMY', text: `Youth coach upgraded to ${MTSM_DATA.YOUTH_COACH_QUALITY.levels[ad.youthCoach]}!` });
    return { success: true, msg: `Youth coach upgraded to ${MTSM_DATA.YOUTH_COACH_QUALITY.levels[ad.youthCoach]}! Wage: £${MTSM_DATA.YOUTH_COACH_QUALITY.costs[ad.youthCoach].toLocaleString()}/week` };
  }

  function downgradeYouthCoach(hpIdx) {
    if (!state.youthAcademyData || !state.youthAcademyData[hpIdx]) return { success: false, msg: 'No academy data.' };
    const ad = state.youthAcademyData[hpIdx];
    if (ad.youthCoach <= 0) return { success: false, msg: 'No youth coach to downgrade.' };
    ad.youthCoach--;
    const levelName = MTSM_DATA.YOUTH_COACH_QUALITY.levels[ad.youthCoach];
    pushNews({ type: 'ACADEMY', text: `Youth coach ${ad.youthCoach === 0 ? 'dismissed' : 'downgraded to ' + levelName}.` });
    return { success: true, msg: ad.youthCoach === 0 ? 'Youth coach dismissed.' : `Youth coach downgraded to ${levelName}.` };
  }

  // ===== SET FORMATION =====
  function setFormation(formationName, teamObj) {
    if (!FORMATIONS[formationName]) return { success: false, msg: 'Invalid formation.' };
    teamObj.formation = formationName;
    const msg = FORMATIONS[formationName].isAuto
      ? 'Custom (Best OVR) selected — auto-select will pick the best 11 overall.'
      : `Formation set to ${formationName}.`;
    return { success: true, msg };
  }

  // ===== SET STARTING XI =====
  function setStartingXI(playerIds, teamObj) {
    if (!playerIds || playerIds.length !== 11) {
      return { success: false, msg: 'You must select exactly 11 players.' };
    }
    // Validate all IDs belong to this team and aren't injured
    const available = teamObj.players.filter(p => p.injured === 0);
    const valid = playerIds.every(id => available.find(p => p.id === id));
    if (!valid) return { success: false, msg: 'One or more selected players are injured or not in the squad.' };

    // Check for a GK
    const hasGK = playerIds.some(id => {
      const p = teamObj.players.find(pl => pl.id === id);
      return p && p.position === 'GK';
    });
    if (!hasGK) return { success: false, msg: 'You must include at least one goalkeeper.' };

    teamObj.startingXI = [...playerIds];
    return { success: true, msg: 'Starting XI updated.' };
  }

  function autoSelectXI(teamObj) {
    const available = teamObj.players.filter(p => p.injured === 0);
    if (available.length < 11) return { success: false, msg: 'Not enough fit players to auto-select.' };

    const formationKey = teamObj.formation;
    const isCustom = !formationKey || FORMATIONS[formationKey]?.isAuto;

    if (isCustom) {
      // Absolute best OVR: pick top 11 regardless of position, then derive a custom formation
      const best11 = [...available].sort((a, b) => b.overall - a.overall).slice(0, 11);
      teamObj.startingXI = best11.map(p => p.id);

      const def = best11.filter(p => p.position === 'DEF').length;
      const mid = best11.filter(p => p.position === 'MID').length;
      const fwd = best11.filter(p => p.position === 'FWD').length;
      // Store computed shape on the custom formation entry so UI can display it
      FORMATIONS['custom'] = { DEF: def, MID: mid, FWD: fwd, bonus: {}, isAuto: true };
      teamObj.formation = 'custom';

      return { success: true, msg: `Auto-selected best XI by overall (${def}-${mid}-${fwd}).` };
    }

    // Formation-based selection
    const best11 = _autoPickByFormation(available, formationKey);
    teamObj.startingXI = best11.map(p => p.id);
    return { success: true, msg: `Auto-selected best XI for ${formationKey}.` };
  }

  // ===== CAREER: RESIGN & CLUB OFFERS =====

  function _getManagerPerformanceScore(hpIdx) {
    const hp = state.humanPlayers[hpIdx];
    if (!hp || hp.sacked) return 0;
    const team = state.divisions[hp.division].teams[hp.teamIndex];
    const table = getLeagueTable(hp.division);
    const pos = table.findIndex(t => t.name === team.name) + 1;

    // Score 0-100 based on: league position, division level, board confidence, win ratio
    let score = 0;
    // Division bonus: higher division = better reputation (0-30)
    score += (3 - hp.division) * 10;
    // League position bonus (0-30): top = 30, bottom = 0
    score += Math.round((16 - pos) / 15 * 30);
    // Win ratio bonus (0-20)
    const winRatio = team.played > 0 ? team.won / team.played : 0;
    score += Math.round(winRatio * 20);
    // Board confidence bonus (0-20)
    if (state.options.boardConfidence) {
      score += Math.round(hp.boardConfidence / 5);
    } else {
      score += 10; // neutral if board confidence is off
    }
    return Math.min(100, Math.max(0, score));
  }

  function generateClubOffers(hpIdx) {
    const hp = state.humanPlayers[hpIdx];
    if (!hp || hp.sacked) return [];

    const perfScore = _getManagerPerformanceScore(hpIdx);
    const currentTeam = state.divisions[hp.division].teams[hp.teamIndex];
    const offers = [];

    // Determine which divisions can offer based on performance
    // Low perf (0-25): only div 4 offers
    // Med perf (26-50): div 3-4 offers
    // Good perf (51-75): div 2-4 offers
    // Great perf (76-100): div 1-4 offers
    let minDiv = 3; // division index (0=top, 3=bottom)
    if (perfScore > 75) minDiv = 0;
    else if (perfScore > 50) minDiv = 1;
    else if (perfScore > 25) minDiv = 2;

    // Can't get offers from a higher division than your current one minus 1
    minDiv = Math.max(minDiv, hp.division - 1);

    // Generate 3 offers from random AI clubs
    const candidates = [];
    for (let d = minDiv; d <= 3; d++) {
      for (let t = 0; t < state.divisions[d].teams.length; t++) {
        const team = state.divisions[d].teams[t];
        // Skip human-managed teams and the manager's current team
        if (team.isHuman) continue;
        candidates.push({ division: d, teamIndex: t, team });
      }
    }

    // Shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Weight: prefer higher-division clubs for high performers
    candidates.sort((a, b) => {
      if (perfScore > 50) return a.division - b.division; // prefer higher divs
      return b.division - a.division; // prefer lower divs for poor performers
    });

    // Pick top 3
    const picked = candidates.slice(0, 3);
    for (const c of picked) {
      const teamStrength = calculateTeamStrength(c.team).overall;
      const avgOverall = c.team.players.length > 0
        ? Math.round(c.team.players.reduce((s, p) => s + p.overall, 0) / c.team.players.length)
        : 0;
      offers.push({
        division: c.division,
        teamIndex: c.teamIndex,
        teamName: c.team.name,
        balance: c.team.balance,
        squadSize: c.team.players.length,
        avgOverall,
        divisionName: `Division ${c.division + 1}`
      });
    }

    return offers;
  }

  function resignManager(hpIdx, option) {
    const hp = state.humanPlayers[hpIdx];
    if (!hp || hp.sacked) return { success: false, msg: 'No active manager.' };

    const oldTeam = state.divisions[hp.division].teams[hp.teamIndex];
    const oldTeamName = oldTeam.name;

    if (option === 'retire') {
      // Permanently end this manager's career
      hp.sacked = true;
      oldTeam.isHuman = false;
      oldTeam.humanPlayerIndex = -1;
      delete oldTeam.humanName;
      pushNews({
        type: 'RESIGN',
        text: `${hp.name} has RETIRED from football management after managing ${oldTeamName}.`
      });
      return { success: true, msg: `${hp.name} has retired from management.`, retired: true };
    }

    if (option === 'restart') {
      // Leave current club, get assigned to a random AI club in Division 4
      oldTeam.isHuman = false;
      oldTeam.humanPlayerIndex = -1;
      delete oldTeam.humanName;

      // Find a random AI team in Division 4
      const div4Teams = state.divisions[3].teams.filter(t => !t.isHuman);
      if (div4Teams.length === 0) return { success: false, msg: 'No available clubs in Division 4.' };
      const newTeam = div4Teams[Math.floor(Math.random() * div4Teams.length)];
      const newTeamIdx = state.divisions[3].teams.indexOf(newTeam);

      newTeam.isHuman = true;
      newTeam.humanPlayerIndex = hpIdx;
      newTeam.humanName = hp.name;
      hp.division = 3;
      hp.teamIndex = newTeamIdx;
      hp.boardConfidence = 50;

      // Reset assistant coach for the new club
      if (state.assistantCoachData) {
        state.assistantCoachData[hpIdx] = { quality: 0, targetLevel: 99 };
      }

      // Reset youth academy for the new club
      if (state.options.youthAcademy && state.youthAcademy) {
        state.youthAcademyData[hpIdx] = {
          quality: 0, youthCoach: 0,
          asstCoach: 0,
          asstTargetLevel: 99
        };
        const prospectCount = MTSM_DATA.ACADEMY_QUALITY.prospectCount[0];
        const skillBonus = MTSM_DATA.ACADEMY_QUALITY.baseSkillBonus[0];
        state.youthAcademy[hpIdx] = generateYouthPlayers(prospectCount, skillBonus);
      }

      // Check if club needs a loan (UI will show modal for user to choose terms)
      const needsLoan = newTeam.balance < 0;
      const loanPreview = needsLoan ? getLoanPreview(newTeam) : null;

      pushNews({
        type: 'RESIGN',
        text: `${hp.name} has resigned from ${oldTeamName} and taken charge of ${newTeam.name} in Division 4!`
      });
      let msg = `You are now manager of ${newTeam.name} in Division 4!`;
      return { success: true, msg, newTeam: newTeam.name, needsLoan, loanPreview };
    }

    return { success: false, msg: 'Invalid option.' };
  }

  function acceptApproachOffer(hpIdx, offerIdx) {
    if (!state.clubOffers || !state.clubOffers[hpIdx]) return { success: false, msg: 'No approach offers.' };
    const offers = state.clubOffers[hpIdx].offers;
    if (offerIdx < 0 || offerIdx >= offers.length) return { success: false, msg: 'Invalid offer.' };
    const offer = offers[offerIdx];
    const result = acceptClubOffer(hpIdx, offer);
    if (result.success) {
      delete state.clubOffers[hpIdx];
    }
    return result;
  }

  function declineApproachOffers(hpIdx) {
    if (state.clubOffers) delete state.clubOffers[hpIdx];
    return { success: true, msg: 'All approach offers declined.' };
  }

  function acceptClubOffer(hpIdx, offer) {
    const hp = state.humanPlayers[hpIdx];
    if (!hp || hp.sacked) return { success: false, msg: 'No active manager.' };

    const oldTeam = state.divisions[hp.division].teams[hp.teamIndex];
    const oldTeamName = oldTeam.name;

    // Verify the target team is still AI-managed
    const targetTeam = state.divisions[offer.division].teams[offer.teamIndex];
    if (!targetTeam || targetTeam.isHuman) {
      return { success: false, msg: 'This club is no longer available.' };
    }

    // Leave old club
    oldTeam.isHuman = false;
    oldTeam.humanPlayerIndex = -1;
    delete oldTeam.humanName;

    // Join new club
    targetTeam.isHuman = true;
    targetTeam.humanPlayerIndex = hpIdx;
    targetTeam.humanName = hp.name;
    hp.division = offer.division;
    hp.teamIndex = offer.teamIndex;
    hp.boardConfidence = 50;

    // Reset assistant coach for the new club
    if (state.assistantCoachData) {
      state.assistantCoachData[hpIdx] = { quality: 0, targetLevel: 99 };
    }

    // Reset youth academy for the new club
    if (state.options.youthAcademy && state.youthAcademy) {
      state.youthAcademyData[hpIdx] = {
        quality: 0, youthCoach: 0,
        asstCoach: 0,
        asstTargetLevel: 99
      };
      const prospectCount = MTSM_DATA.ACADEMY_QUALITY.prospectCount[0];
      const skillBonus = MTSM_DATA.ACADEMY_QUALITY.baseSkillBonus[0];
      state.youthAcademy[hpIdx] = generateYouthPlayers(prospectCount, skillBonus);
    }

    // Check if club needs a loan (UI will show modal for user to choose terms)
    const needsLoan = targetTeam.balance < 0;
    const loanPreview = needsLoan ? getLoanPreview(targetTeam) : null;

    pushNews({
      type: 'TRANSFER',
      text: `${hp.name} has left ${oldTeamName} to become the new manager of ${targetTeam.name} (Division ${offer.division + 1})!`
    });

    let msg = `Welcome to ${targetTeam.name}! You are now managing in Division ${offer.division + 1}.`;
    return { success: true, msg, needsLoan, loanPreview };
  }

  // ===== LOAN SYSTEM =====
  // When a manager joins a club in debt, an emergency loan is issued automatically.
  // The loan covers the debt + a random bonus (5,000–15,000) to give some runway.
  // Repayment is deducted automatically each week in processWeeklyCosts.
  // repaymentWeeks: user-chosen term (30–150), default 40. Max 5 seasons (150 weeks).
  function issueEmergencyLoan(team, repaymentWeeks) {
    if (team.balance >= 0) return null; // no loan needed

    const weeks = Math.max(30, Math.min(150, repaymentWeeks || 40));
    const debtCover = Math.abs(team.balance);
    const bonus = 5000 + Math.floor(Math.random() * 10001); // 5k–15k extra
    const loanAmount = debtCover + bonus;
    const weeklyRepayment = Math.max(500, Math.round(loanAmount / weeks));

    team.loan = {
      original: loanAmount,
      remaining: loanAmount,
      weeklyRepayment,
      repaymentWeeks: weeks
    };

    // Credit the loan to the balance
    team.balance += loanAmount;

    return { loanAmount, weeklyRepayment, weeksToRepay: Math.ceil(loanAmount / weeklyRepayment) };
  }

  // Preview loan terms without issuing (for UI modal)
  function getLoanPreview(team) {
    if (team.balance >= 0) return null;
    const debtCover = Math.abs(team.balance);
    const bonus = 5000 + Math.floor(Math.random() * 10001);
    const loanAmount = debtCover + bonus;
    // Store the preview so the same bonus is used when confirming
    team._loanPreview = loanAmount;
    return { loanAmount };
  }

  // Issue loan using a previously previewed amount
  function confirmEmergencyLoan(team, repaymentWeeks) {
    if (team.balance >= 0) { delete team._loanPreview; return null; }
    const weeks = Math.max(30, Math.min(150, repaymentWeeks || 40));
    const loanAmount = team._loanPreview || (Math.abs(team.balance) + 5000 + Math.floor(Math.random() * 10001));
    delete team._loanPreview;
    const weeklyRepayment = Math.max(500, Math.round(loanAmount / weeks));

    team.loan = {
      original: loanAmount,
      remaining: loanAmount,
      weeklyRepayment,
      repaymentWeeks: weeks
    };
    team.balance += loanAmount;
    return { loanAmount, weeklyRepayment, weeksToRepay: Math.ceil(loanAmount / weeklyRepayment) };
  }

  // Adjust repayment term on an existing loan (30–150 weeks)
  function setLoanRepaymentTerm(team, weeks) {
    if (!team.loan || team.loan.remaining <= 0) return { success: false, msg: 'No active loan.' };
    const w = Math.max(30, Math.min(150, weeks));
    const newWeekly = Math.max(500, Math.round(team.loan.remaining / w));
    team.loan.weeklyRepayment = newWeekly;
    team.loan.repaymentWeeks = w;
    return { success: true, msg: `Repayment adjusted to £${newWeekly.toLocaleString()}/week over ~${Math.ceil(team.loan.remaining / newWeekly)} weeks.` };
  }

  function getTeamLoan(team) {
    return team.loan || null;
  }

  function repayLoanEarly(team, amount) {
    if (!team.loan || team.loan.remaining <= 0) return { success: false, msg: 'No active loan.' };
    if (amount > team.balance) return { success: false, msg: 'Insufficient funds.' };
    const payment = Math.min(amount, team.loan.remaining);
    team.balance -= payment;
    team.loan.remaining -= payment;
    if (team.loan.remaining <= 0) {
      delete team.loan;
      return { success: true, msg: `Loan fully repaid! Paid £${payment.toLocaleString()}.`, cleared: true };
    }
    return { success: true, msg: `Paid £${payment.toLocaleString()}. Remaining: £${team.loan.remaining.toLocaleString()}.` };
  }

  // ===== AI MANAGER DECISION ENGINE =====

  // Structured log entry for AI manager decisions — used for analysis and tuning
  function _logAIDecision(team, aiData, personality, action, details) {
    if (!state.aiManagerLog) state.aiManagerLog = [];
    const leaguePos = details.leaguePos || null;
    state.aiManagerLog.push({
      season: state.season,
      week: state.week,
      phase: _getSeasonPhase(state.week),
      team: team.name,
      division: details.division != null ? details.division + 1 : null,
      manager: aiData.managerName,
      personality: personality.key,
      action,                     // 'buy', 'sell', 'emergency_sell', 'panic_buy', 'squad_fill', 'formation_change', 'staff_upgrade', 'ground_upgrade', 'training', 'transfer_skipped'
      leaguePos,
      balance: team.balance,
      squadSize: team.players.length,
      consecutiveLosses: aiData.consecutiveLosses,
      seasonBuys: aiData.seasonBuys,
      seasonSells: aiData.seasonSells,
      detail: details.detail || null  // free-form context string
    });
    // Cap log to prevent unbounded growth (keep last 5000 entries)
    if (state.aiManagerLog.length > 5000) {
      state.aiManagerLog = state.aiManagerLog.slice(-4000);
    }
  }

  function _getSeasonPhase(week) {
    if (week <= 10) return 'early';
    if (week <= 20) return 'mid';
    return 'late';
  }

  function _getAIPersonality(teamName) {
    if (!state.aiManagerData || !state.aiManagerData[teamName]) return null;
    const data = state.aiManagerData[teamName];
    return MTSM_DATA.AI_MANAGER_TYPES.find(t => t.key === data.personality) || null;
  }

  function _getTeamAvgOverall(team) {
    if (team.players.length === 0) return 0;
    return team.players.reduce((s, p) => s + p.overall, 0) / team.players.length;
  }

  function _getTeamLeaguePosition(team, divIndex) {
    const table = getLeagueTable(divIndex);
    return table.findIndex(t => t.name === team.name) + 1;
  }

  function processAIManagerDecisions() {
    if (!state.options.aiManagers || !state.aiManagerData) return;

    for (let d = 0; d < 4; d++) {
      const div = state.divisions[d];
      for (let t = 0; t < div.teams.length; t++) {
        const team = div.teams[t];
        if (team.isHuman) continue;
        const aiData = state.aiManagerData[team.name];
        if (!aiData) continue;
        const personality = _getAIPersonality(team.name);
        if (!personality) continue;

        // Track consecutive losses from form
        const lastResult = team.form.length > 0 ? team.form[team.form.length - 1] : null;
        if (lastResult === 'L') {
          aiData.consecutiveLosses++;
        } else {
          aiData.consecutiveLosses = 0;
        }

        // 1. SURVIVAL CHECK
        _aiSurvivalCheck(team, aiData, personality, d);

        // 2. SQUAD HEALTH — fill gaps
        _aiSquadHealth(team, aiData, personality, d);

        // 3. TRAINING REFRESH (every 4 weeks)
        if (state.week % 4 === 0) {
          const pos = _getTeamLeaguePosition(team, d);
          const totalTeams = state.divisions[d].teams.length;
          const inBottom4 = pos > totalTeams - 4;
          const inTop4 = pos <= 4;
          _applyAITrainingStyle(team, personality, pos, totalTeams);
          const style = inBottom4 ? 'defensive (bottom 4 override)' : inTop4 ? 'offensive (top 4 override)' : personality.trainingStyle;
          _logAIDecision(team, aiData, personality, 'training', {
            division: d, leaguePos: pos,
            detail: `Training refresh: style=${style}, pos ${pos}/${totalTeams}`
          });
        }

        // 4. TRANSFER DECISIONS (every 3-5 weeks depending on personality)
        const transferInterval = personality.riskTolerance > 0.5 ? 3 : 5;
        if (state.week - aiData.lastTransferWeek >= transferInterval) {
          _aiTransferDecisions(team, aiData, personality, d);
          aiData.lastTransferWeek = state.week;
        }

        // 5. STAFF UPGRADES (every 6-8 weeks)
        const staffInterval = personality.staffPriority[0] === 'Coach' ? 6 : 8;
        if (state.week - aiData.lastStaffWeek >= staffInterval) {
          _aiStaffUpgrades(team, aiData, personality);
          aiData.lastStaffWeek = state.week;
        }

        // 6. GROUND UPGRADES (every 10 weeks)
        if (state.week - aiData.lastGroundWeek >= 10) {
          _aiGroundUpgrades(team, aiData, personality);
          aiData.lastGroundWeek = state.week;
        }

        // 7. FORMATION ADJUSTMENT (every 5 weeks, if enabled)
        if (state.options.formationStrategy && state.week - aiData.lastFormationWeek >= 5) {
          _aiFormationAdjust(team, aiData, personality, d);
          aiData.lastFormationWeek = state.week;
        }

        // 8. PANIC MODE — losing streak
        if (aiData.consecutiveLosses >= personality.panicBuyThreshold) {
          _aiPanicMode(team, aiData, personality, d);
        }
      }
    }
  }

  function _aiSurvivalCheck(team, aiData, personality, divIndex) {
    // Sell highest-value player if in serious debt
    if (team.balance < -30000 && team.players.length > 11) {
      const sorted = [...team.players].sort((a, b) => b.value - a.value);
      const toSell = sorted[0];
      if (toSell) {
        const salePrice = Math.round(toSell.value * (0.7 + Math.random() * 0.5));
        team.balance += salePrice;
        recordFinance(team, 'income', salePrice, `Emergency sale: ${toSell.name}`);
        toSell.askingPrice = Math.round(salePrice * 1.2);
        state.transferPool.push(toSell);
        team.players.splice(team.players.indexOf(toSell), 1);
        aiData.seasonSells++;
        pushNews({
          type: 'AI_TRANSFER',
          text: `${team.name} (${aiData.managerName}) emergency-sold ${toSell.name} (${toSell.position}, OVR ${toSell.overall}) for £${salePrice.toLocaleString()} to avoid financial ruin!`
        });
        _logAIDecision(team, aiData, personality, 'emergency_sell', {
          division: divIndex,
          detail: `Sold ${toSell.name} (${toSell.position}, OVR ${toSell.overall}) for £${salePrice.toLocaleString()} — balance was £${(team.balance - salePrice).toLocaleString()}`
        });
      }
    }
  }

  function _aiSquadHealth(team, aiData, personality, divIndex) {
    // Emergency buy if squad too small
    if (team.players.length < 14) {
      const budget = Math.max(team.balance * 0.3, 5000);
      _logAIDecision(team, aiData, personality, 'squad_fill', {
        division: divIndex,
        detail: `Squad too small (${team.players.length} players) — emergency buy with £${budget.toLocaleString()} budget`
      });
      _aiBuyPlayer(team, aiData, personality, divIndex, budget, null);
    }

    // Check position gaps
    const posCount = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const p of team.players) {
      if (p.injured === 0) posCount[p.position]++;
    }
    // Need at least 1 GK, 3 DEF, 2 MID, 1 FWD fit
    const minPos = { GK: 1, DEF: 3, MID: 2, FWD: 1 };
    for (const [pos, min] of Object.entries(minPos)) {
      if (posCount[pos] < min && team.balance > 5000) {
        _logAIDecision(team, aiData, personality, 'squad_fill', {
          division: divIndex,
          detail: `Position gap: ${pos} has ${posCount[pos]}/${min} fit players`
        });
        _aiBuyPlayer(team, aiData, personality, divIndex, team.balance * 0.25, pos);
      }
    }
  }

  function _aiTransferDecisions(team, aiData, personality, divIndex) {
    const phase = _getSeasonPhase(state.week);
    const leaguePos = _getTeamLeaguePosition(team, divIndex);
    const totalTeams = state.divisions[divIndex].teams.length;
    const inBottom2 = leaguePos > totalTeams - 2;
    const inBottomHalf = leaguePos > totalTeams / 2;
    const inBottom4 = leaguePos > totalTeams - 4;
    const inTop3 = leaguePos <= 3;
    const inTop4 = leaguePos <= 4;

    // Season-phase transfer restrictions
    if (phase === 'mid') {
      // Mid season: only buy if in bottom half or surplus budget
      const surplusBudget = team.balance > 50000;
      if (!inBottomHalf && !surplusBudget) {
        _logAIDecision(team, aiData, personality, 'transfer_skipped', {
          division: divIndex, leaguePos,
          detail: `Mid-season freeze — pos ${leaguePos}/${totalTeams}, not in bottom half, no surplus`
        });
        return;
      }
    } else if (phase === 'late') {
      // Late season: freeze unless in relegation zone or title contention
      if (!inBottom2 && !inTop3) {
        _logAIDecision(team, aiData, personality, 'transfer_skipped', {
          division: divIndex, leaguePos,
          detail: `Late-season freeze — pos ${leaguePos}/${totalTeams}, not in danger or contention`
        });
        return;
      }
    }

    // Determine budget
    let spendPct = personality.spendPct;
    if (personality.key === 'gambler') {
      spendPct = 0.1 + Math.random() * 0.7; // randomize for gamblers
    }

    // Season history adjustments: if relegated last season, spend more
    if (aiData.seasonHistory && aiData.seasonHistory.length > 0) {
      const lastSeason = aiData.seasonHistory[aiData.seasonHistory.length - 1];
      if (lastSeason.relegated) {
        spendPct = Math.min(1.0, spendPct + 0.15);
      } else if (lastSeason.promoted) {
        spendPct = Math.max(0.05, spendPct - 0.10);
      }
    }

    // Desperate buys in relegation zone during late season
    if (phase === 'late' && inBottom2) {
      spendPct = Math.min(1.0, spendPct + 0.20);
    }

    const budget = Math.max(0, team.balance * spendPct);
    if (budget < 3000) return; // not enough to do anything

    // Cap seasonal buys to prevent excessive activity
    let maxBuys = 4;
    if (phase === 'late' && inTop3) maxBuys = 5; // allow 1 more strategic buy for title contenders
    if (aiData.seasonBuys >= maxBuys) return;

    // Find weakest position
    const posAvg = {};
    const posCounts = {};
    for (const p of team.players) {
      if (!posAvg[p.position]) { posAvg[p.position] = 0; posCounts[p.position] = 0; }
      posAvg[p.position] += p.overall;
      posCounts[p.position]++;
    }
    for (const pos of Object.keys(posAvg)) {
      posAvg[pos] = posCounts[pos] > 0 ? posAvg[pos] / posCounts[pos] : 0;
    }
    // Sort positions by average overall (weakest first)
    const weakestPos = Object.keys(posAvg).sort((a, b) => posAvg[a] - posAvg[b]);
    let targetPos = weakestPos[0] || 'MID';

    // League-position awareness: bottom 4 prioritize DEF, top 4 allow FWD
    if (inBottom4) {
      targetPos = 'DEF';
    } else if (inTop4 && Math.random() > 0.5) {
      targetPos = 'FWD';
    }

    // Try to buy a player for the target position
    _aiBuyPlayer(team, aiData, personality, divIndex, budget, targetPos);

    // Sell underperforming players (if squad large enough)
    if (team.players.length > 18) {
      const teamAvg = _getTeamAvgOverall(team);
      const threshold = teamAvg * personality.sellThreshold;
      // Developer: also sell old players
      const candidates = team.players.filter(p => {
        if (p.overall >= threshold) return false;
        if (personality.key === 'developer' && p.age >= 30) return true;
        return true;
      }).sort((a, b) => a.overall - b.overall);

      if (candidates.length > 0 && team.players.length > 14) {
        const toSell = candidates[0];
        const salePrice = Math.round(toSell.value * (0.7 + Math.random() * 0.5));
        team.balance += salePrice;
        recordFinance(team, 'income', salePrice, `Sale: ${toSell.name}`);
        toSell.askingPrice = Math.round(salePrice * 1.2);
        state.transferPool.push(toSell);
        team.players.splice(team.players.indexOf(toSell), 1);
        aiData.seasonSells++;
        pushNews({
          type: 'AI_TRANSFER',
          text: `${team.name} (${aiData.managerName}) sold ${toSell.name} (${toSell.position}, OVR ${toSell.overall}) for £${salePrice.toLocaleString()}.`
        });
        _logAIDecision(team, aiData, personality, 'sell', {
          division: divIndex, leaguePos,
          detail: `Sold ${toSell.name} (${toSell.position}, OVR ${toSell.overall}) for £${salePrice.toLocaleString()} — below threshold ${Math.round(threshold)} (team avg ${Math.round(teamAvg)})`
        });
      }
    }
  }

  function _aiBuyPlayer(team, aiData, personality, divIndex, budget, targetPos) {
    if (team.players.length >= 25) return; // squad full
    if (budget < 1000) return;

    // Search the transfer pool
    const candidates = state.transferPool.filter(p => {
      const price = p.askingPrice || p.value;
      if (price > budget) return false;
      if (targetPos && p.position !== targetPos) return false;
      // Age preference
      if (p.age < personality.buyAgeRange[0] || p.age > personality.buyAgeRange[1]) {
        // Allow but with reduced chance (except strict Developer)
        if (personality.key === 'developer' && p.age > personality.buyAgeRange[1]) return false;
        if (Math.random() > 0.3) return false;
      }
      return true;
    });

    if (candidates.length === 0) return;

    // Sort by best value for money (overall per price)
    candidates.sort((a, b) => {
      const priceA = a.askingPrice || a.value;
      const priceB = b.askingPrice || b.value;
      // Moneybag prefers raw overall, others prefer value
      if (personality.key === 'moneybag') return b.overall - a.overall;
      return (b.overall / (priceB || 1)) - (a.overall / (priceA || 1));
    });

    // Gambler picks randomly from top 5
    let pick;
    if (personality.key === 'gambler' && candidates.length > 1) {
      pick = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
    } else {
      pick = candidates[0];
    }

    const price = pick.askingPrice || pick.value;
    if (team.balance < price) return;

    // Execute purchase
    team.balance -= price;
    recordFinance(team, 'expense', price, `Transfer: ${pick.name}`);
    delete pick.askingPrice;
    team.players.push(pick);
    const idx = state.transferPool.indexOf(pick);
    if (idx !== -1) state.transferPool.splice(idx, 1);
    aiData.seasonBuys++;

    pushNews({
      type: 'AI_TRANSFER',
      text: `${team.name} (${aiData.managerName}) signed ${pick.name} (${pick.position}, OVR ${pick.overall}) for £${price.toLocaleString()}.`
    });
    _logAIDecision(team, aiData, personality, 'buy', {
      division: divIndex,
      detail: `Signed ${pick.name} (${pick.position}, age ${pick.age}, OVR ${pick.overall}) for £${price.toLocaleString()} — target: ${targetPos || 'any'}, budget: £${Math.round(budget).toLocaleString()}, ${candidates.length} candidates`
    });
  }

  function _aiStaffUpgrades(team, aiData, personality) {
    // Try to upgrade the highest-priority staff that isn't maxed
    const priorities = personality.staffPriority;
    const seen = new Set();
    for (const role of priorities) {
      if (seen.has(role)) continue;
      seen.add(role);
      const staff = team.staff[role];
      if (!staff || staff.quality >= 4) continue;
      const newQuality = staff.quality + 1;
      const newWage = MTSM_DATA.STAFF_COSTS[newQuality];
      const weeklyIncrease = newWage - staff.wage;
      // Only upgrade if we can afford the increased wages for ~4 weeks
      if (team.balance > weeklyIncrease * 4 && team.balance > 2000) {
        team.staff[role] = { quality: newQuality, wage: newWage };
        pushNews({
          type: 'AI_STAFF',
          text: `${team.name} (${aiData.managerName}) upgraded ${role} to ${MTSM_DATA.STAFF_QUALITIES[newQuality]}.`
        });
        _logAIDecision(team, aiData, personality, 'staff_upgrade', {
          detail: `Upgraded ${role} to tier ${newQuality} (${MTSM_DATA.STAFF_QUALITIES[newQuality]}), wage +£${weeklyIncrease}/wk`
        });
        return; // one upgrade per cycle
      }
    }
  }

  function _aiGroundUpgrades(team, aiData, personality) {
    const priorities = personality.groundPriority;
    const safetyMultiplier = personality.key === 'moneybag' ? 1.2 :
                             personality.key === 'developer' ? 3.0 : 2.0;

    for (const type of priorities) {
      const current = team.ground[type];
      const upgrades = MTSM_DATA.GROUND_UPGRADES[type];
      if (current >= upgrades.costs.length - 1) continue; // maxed
      const cost = upgrades.costs[current + 1];
      if (team.balance > cost * safetyMultiplier) {
        team.balance -= cost;
        team.ground[type] = current + 1;
        recordFinance(team, 'expense', cost, `Ground: ${type} upgrade`);
        const levelName = typeof upgrades.levels[current + 1] === 'number'
          ? upgrades.levels[current + 1].toLocaleString()
          : upgrades.levels[current + 1];
        pushNews({
          type: 'AI_GROUND',
          text: `${team.name} (${aiData.managerName}) upgraded ${type} to ${levelName}.`
        });
        _logAIDecision(team, aiData, personality, 'ground_upgrade', {
          detail: `Upgraded ${type} to ${levelName} for £${cost.toLocaleString()}`
        });
        return; // one upgrade per cycle
      }
    }
  }

  function _aiFormationAdjust(team, aiData, personality, divIndex) {
    const phase = _getSeasonPhase(state.week);
    const leaguePos = _getTeamLeaguePosition(team, divIndex);
    const totalTeams = state.divisions[divIndex].teams.length;
    const inBottom2 = leaguePos > totalTeams - 2;
    const inTop3 = leaguePos <= 3;

    // Late season overrides: relegation zone forces defensive, title race allows attacking
    if (phase === 'late' && inBottom2) {
      if (team.formation !== '5-3-2') {
        const oldF = team.formation;
        team.formation = '5-3-2';
        pushNews({
          type: 'AI_TACTICS',
          text: `${team.name} (${aiData.managerName}) switched to 5-3-2 in a desperate bid to avoid relegation.`
        });
        _logAIDecision(team, aiData, personality, 'formation_change', {
          division: divIndex, leaguePos,
          detail: `${oldF} → 5-3-2 (relegation survival, pos ${leaguePos}/${totalTeams})`
        });
      }
      return;
    }
    if (phase === 'late' && inTop3) {
      const attackingFormations = ['4-3-3', '3-4-3', '3-5-2'];
      if (!attackingFormations.includes(team.formation)) {
        const oldF = team.formation;
        const newF = attackingFormations[Math.floor(Math.random() * attackingFormations.length)];
        team.formation = newF;
        pushNews({
          type: 'AI_TACTICS',
          text: `${team.name} (${aiData.managerName}) switched to ${newF} to push for the title.`
        });
        _logAIDecision(team, aiData, personality, 'formation_change', {
          division: divIndex, leaguePos,
          detail: `${oldF} → ${newF} (title push, pos ${leaguePos}/${totalTeams})`
        });
      }
      return;
    }

    if (Math.random() > personality.formationFlexibility) return; // not changing

    const formations = Object.keys(FORMATIONS).filter(f => f !== 'custom');

    if (personality.key === 'tactician') {
      // Pick formation that best matches squad composition
      const posCount = { DEF: 0, MID: 0, FWD: 0 };
      const available = team.players.filter(p => p.injured === 0);
      for (const p of available) {
        if (posCount[p.position] !== undefined) posCount[p.position]++;
      }
      let bestFormation = team.formation || '4-4-2';
      let bestScore = -1;
      for (const fKey of formations) {
        const f = FORMATIONS[fKey];
        let score = 0;
        for (const pos of ['DEF', 'MID', 'FWD']) {
          score += Math.min(posCount[pos], f[pos]) * 10;
          // Bonus for filling all slots
          if (posCount[pos] >= f[pos]) score += 5;
        }
        // Add formation bonus value
        for (const [, bonus] of Object.entries(f.bonus || {})) {
          score += bonus;
        }
        if (score > bestScore) { bestScore = score; bestFormation = fKey; }
      }
      if (bestFormation !== team.formation) {
        const oldF = team.formation;
        team.formation = bestFormation;
        pushNews({
          type: 'AI_TACTICS',
          text: `${team.name} (${aiData.managerName}) switched to ${bestFormation} formation.`
        });
        _logAIDecision(team, aiData, personality, 'formation_change', {
          division: divIndex,
          detail: `${oldF} → ${bestFormation} (tactician squad-fit analysis)`
        });
      }
    } else if (personality.key === 'gambler') {
      // Random formation
      const newFormation = formations[Math.floor(Math.random() * formations.length)];
      if (newFormation !== team.formation) {
        const oldF = team.formation;
        team.formation = newFormation;
        pushNews({
          type: 'AI_TACTICS',
          text: `${team.name} (${aiData.managerName}) switched to ${newFormation} formation.`
        });
        _logAIDecision(team, aiData, personality, 'formation_change', {
          division: divIndex,
          detail: `${oldF} → ${newFormation} (gambler random pick)`
        });
      }
    } else if (personality.key === 'pragmatist') {
      // Only change if on a losing streak
      if (aiData.consecutiveLosses >= 3) {
        const oldF = team.formation;
        team.formation = '5-3-2'; // defensive
        pushNews({
          type: 'AI_TACTICS',
          text: `${team.name} (${aiData.managerName}) switched to 5-3-2 to shore up the defence.`
        });
        _logAIDecision(team, aiData, personality, 'formation_change', {
          division: divIndex,
          detail: `${oldF} → 5-3-2 (pragmatist losing streak: ${aiData.consecutiveLosses} losses)`
        });
      }
    }
    // Developer and moneybag stay with preferred formation
  }

  function _aiPanicMode(team, aiData, personality, divIndex) {
    // Emergency response to losing streak
    // Try to buy a quality player for the weakest position
    const budget = Math.min(team.balance * 0.5, team.balance);
    if (budget > 5000 && aiData.seasonBuys < 6) {
      _logAIDecision(team, aiData, personality, 'panic_buy', {
        division: divIndex,
        detail: `Panic mode triggered after ${aiData.consecutiveLosses} consecutive losses — budget £${Math.round(budget).toLocaleString()}`
      });
      _aiBuyPlayer(team, aiData, personality, divIndex, budget, null);
    }
    // Reset consecutive losses counter after panic action
    aiData.consecutiveLosses = 0;
  }

  // Record AI manager season history before promotions/relegations change divisions
  function _recordAIManagerSeasonHistory(promotions, relegations) {
    if (!state.aiManagerData) return;
    const promotedNames = new Set(promotions.map(p => p.team.name));
    const relegatedNames = new Set(relegations.map(r => r.team.name));

    for (let d = 0; d < 4; d++) {
      const table = getLeagueTable(d);
      for (let idx = 0; idx < table.length; idx++) {
        const teamName = table[idx].name;
        const aiData = state.aiManagerData[teamName];
        if (!aiData) continue;
        if (!aiData.seasonHistory) aiData.seasonHistory = [];
        const seasonRecord = {
          season: state.season,
          division: d + 1,
          position: idx + 1,
          buys: aiData.seasonBuys || 0,
          sells: aiData.seasonSells || 0,
          promoted: promotedNames.has(teamName),
          relegated: relegatedNames.has(teamName)
        };
        aiData.seasonHistory.push(seasonRecord);
        // Log season-end summary for each AI team
        const personality = _getAIPersonality(teamName);
        if (personality) {
          const team = state.divisions[d].teams.find(t => t.name === teamName);
          if (team) {
            _logAIDecision(team, aiData, personality, 'season_end', {
              division: d, leaguePos: idx + 1,
              detail: `Season ${state.season} finished: Div ${d + 1}, pos ${idx + 1}/${table.length}, ${seasonRecord.buys} buys, ${seasonRecord.sells} sells${seasonRecord.promoted ? ', PROMOTED' : ''}${seasonRecord.relegated ? ', RELEGATED' : ''}`
            });
          }
        }
      }
    }
  }

  // Reset AI manager seasonal counters at end of season
  function _resetAIManagerSeasonData() {
    if (!state.aiManagerData) return;
    for (const teamName of Object.keys(state.aiManagerData)) {
      const d = state.aiManagerData[teamName];
      d.seasonBuys = 0;
      d.seasonSells = 0;
      d.lastTransferWeek = 0;
      d.lastStaffWeek = 0;
      d.lastGroundWeek = 0;
      d.lastFormationWeek = 0;
      d.consecutiveLosses = 0;
    }
  }

  // Get AI manager info for a team (used by UI)
  function getAIManagerInfo(teamName) {
    if (!state.aiManagerData || !state.aiManagerData[teamName]) return null;
    const data = state.aiManagerData[teamName];
    const personality = MTSM_DATA.AI_MANAGER_TYPES.find(t => t.key === data.personality);
    return {
      managerName: data.managerName,
      personality: personality ? personality.label : 'Unknown',
      personalityKey: data.personality,
      icon: personality ? personality.icon : '?',
      seasonBuys: data.seasonBuys,
      seasonSells: data.seasonSells
    };
  }

  // Aggregate AI log into per-team summary stats for quick analysis
  function getAIManagerLogSummary() {
    const log = (state && state.aiManagerLog) ? state.aiManagerLog : [];
    const teams = {};
    for (const entry of log) {
      if (!teams[entry.team]) {
        teams[entry.team] = {
          team: entry.team, personality: entry.personality, manager: entry.manager,
          buys: 0, sells: 0, emergencySells: 0, panicBuys: 0,
          formationChanges: 0, staffUpgrades: 0, groundUpgrades: 0,
          transfersSkipped: 0, squadFills: 0, trainingRefreshes: 0, seasonsCompleted: 0,
          byPhase: { early: 0, mid: 0, late: 0 },
          entries: []
        };
      }
      const t = teams[entry.team];
      if (entry.action === 'buy') t.buys++;
      else if (entry.action === 'sell') t.sells++;
      else if (entry.action === 'emergency_sell') t.emergencySells++;
      else if (entry.action === 'panic_buy') t.panicBuys++;
      else if (entry.action === 'formation_change') t.formationChanges++;
      else if (entry.action === 'staff_upgrade') t.staffUpgrades++;
      else if (entry.action === 'ground_upgrade') t.groundUpgrades++;
      else if (entry.action === 'transfer_skipped') t.transfersSkipped++;
      else if (entry.action === 'squad_fill') t.squadFills++;
      else if (entry.action === 'training') t.trainingRefreshes++;
      else if (entry.action === 'season_end') t.seasonsCompleted++;
      if (entry.phase) t.byPhase[entry.phase]++;
      t.entries.push(entry);
    }
    return { totalEntries: log.length, teams };
  }

  // ===== SAVE / LOAD =====
  function saveGame() {
    if (!state) return null;
    return JSON.parse(JSON.stringify(state)); // deep clone
  }

  function loadGame(savedState) {
    if (!savedState || !savedState.divisions) return false;
    // Ensure options exist for backward compatibility
    if (!savedState.options) savedState.options = { ...DEFAULT_OPTIONS };
    if (!savedState.newsLog) savedState.newsLog = [];
    if (!savedState.clubHistory) savedState.clubHistory = {};
    if (!savedState.matchLog) savedState.matchLog = {};
    if (!savedState.weeklyFinances) savedState.weeklyFinances = {};
    if (!savedState.youthAcademyData) savedState.youthAcademyData = {};
    if (!savedState.clubOffers) savedState.clubOffers = {};
    if (!savedState.assistantCoachData) savedState.assistantCoachData = {};
    // Ensure AI manager option defaults
    if (savedState.options && savedState.options.aiManagers === undefined) savedState.options.aiManagers = false;
    if (savedState.options && savedState.options.aiManagers && !savedState.aiManagerData) savedState.aiManagerData = {};
    if (!savedState.aiManagerLog) savedState.aiManagerLog = [];
    // Ensure AI manager data has seasonHistory for backward compatibility
    if (savedState.aiManagerData) {
      for (const key of Object.keys(savedState.aiManagerData)) {
        if (!savedState.aiManagerData[key].seasonHistory) savedState.aiManagerData[key].seasonHistory = [];
      }
    }
    // Ensure youth academy data has assistant coach fields
    if (savedState.youthAcademyData) {
      for (const key of Object.keys(savedState.youthAcademyData)) {
        const ad = savedState.youthAcademyData[key];
        if (ad.asstCoach === undefined) ad.asstCoach = 0;
        if (ad.asstTargetLevel === undefined) ad.asstTargetLevel = 99;
      }
    }
    // Migrate GK players: rename Shooting → Handling for backward compatibility
    for (const div of savedState.divisions) {
      for (const team of div.teams) {
        for (const p of team.players) {
          if (p.position === 'GK' && p.skills.Shooting !== undefined && p.skills.Handling === undefined) {
            p.skills.Handling = p.skills.Shooting;
            delete p.skills.Shooting;
            if (p.training === 'Shooting') p.training = 'Handling';
            if (p.userTraining === 'Shooting') p.userTraining = 'Handling';
          }
        }
      }
    }
    // Also migrate youth academy prospects
    if (savedState.youthAcademy) {
      for (const key of Object.keys(savedState.youthAcademy)) {
        const academy = savedState.youthAcademy[key];
        if (Array.isArray(academy)) {
          for (const p of academy) {
            if (p.position === 'GK' && p.skills.Shooting !== undefined && p.skills.Handling === undefined) {
              p.skills.Handling = p.skills.Shooting;
              delete p.skills.Shooting;
              if (p.training === 'Shooting') p.training = 'Handling';
              if (p.userTraining === 'Shooting') p.userTraining = 'Handling';
            }
          }
        }
      }
    }
    // Also migrate transfer pool
    if (savedState.transferPool) {
      for (const p of savedState.transferPool) {
        if (p.position === 'GK' && p.skills.Shooting !== undefined && p.skills.Handling === undefined) {
          p.skills.Handling = p.skills.Shooting;
          delete p.skills.Shooting;
        }
      }
    }
    // Recalculate OVR for all players using position-weighted formula
    for (const div of savedState.divisions) {
      for (const team of div.teams) {
        for (const p of team.players) {
          p.overall = MTSM_DATA.calcOverall(p.position, p.skills);
        }
      }
    }
    if (savedState.youthAcademy) {
      for (const key of Object.keys(savedState.youthAcademy)) {
        const academy = savedState.youthAcademy[key];
        if (Array.isArray(academy)) {
          for (const p of academy) {
            p.overall = MTSM_DATA.calcOverall(p.position, p.skills);
          }
        }
      }
    }
    if (savedState.transferPool) {
      for (const p of savedState.transferPool) {
        p.overall = MTSM_DATA.calcOverall(p.position, p.skills);
      }
    }
    state = savedState;
    return true;
  }

  return {
    initGame,
    getState,
    getCurrentHumanTeam,
    getAllHumanTeams,
    playMatchDay,
    buyPlayer,
    sellPlayer,
    upgradeStaff,
    downgradeStaff,
    upgradeGround,
    processEndOfSeason,
    getLeagueTable,
    getNextFixtures,
    calculateTeamStrength,
    saveGame,
    loadGame,
    signYouthPlayer,
    releaseYouthPlayer,
    upgradeAcademyQuality,
    upgradeYouthCoach,
    downgradeYouthCoach,
    setFormation,
    setStartingXI,
    autoSelectXI,
    getStartingEleven,
    generateClubOffers,
    resignManager,
    acceptClubOffer,
    acceptApproachOffer,
    declineApproachOffers,
    upgradeAssistantCoach,
    downgradeAssistantCoach,
    setAssistantCoachConfig,
    getAutoTraining,
    getYouthAutoTraining,
    upgradeYouthAssistantCoach,
    downgradeYouthAssistantCoach,
    setYouthAssistantCoachConfig,
    FORMATIONS,
    findTeamDivisionIndex,
    CUP_PRIZE_MONEY,
    NATIONAL_CUP_PRIZE_MONEY,
    LEAGUE_TROPHY_PRIZE_MONEY,
    getTeamLoan,
    repayLoanEarly,
    issueEmergencyLoan,
    getLoanPreview,
    confirmEmergencyLoan,
    setLoanRepaymentTerm,
    getAIManagerInfo,
    getAIManagerLog: () => (state && state.aiManagerLog) ? state.aiManagerLog : [],
    getAIManagerLogSummary
  };

})();

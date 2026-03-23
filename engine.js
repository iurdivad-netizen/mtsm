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
    cupPrizeMoney: false
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
        youthAcademyData[i] = { quality: 0, youthCoach: 0 }; // both start at level 0
        const prospectCount = MTSM_DATA.ACADEMY_QUALITY.prospectCount[0];
        const skillBonus = MTSM_DATA.ACADEMY_QUALITY.baseSkillBonus[0];
        youthAcademy[i] = generateYouthPlayers(prospectCount, skillBonus);
      }
    }

    // Initialize club history for each human player
    const clubHistory = {};
    const matchLog = {};
    for (let i = 0; i < humanPlayers.length; i++) {
      clubHistory[i] = [];
      matchLog[i] = [];
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
      matchLog
    };

    return state;
  }

  function getState() { return state; }

  function getCurrentHumanTeam() {
    if (!state) return null;
    const hp = state.humanPlayers[state.currentPlayerIndex];
    if (!hp || hp.sacked) return null;
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
    '3-4-3': { DEF: 3, MID: 4, FWD: 3, bonus: { FWD: 4 } }
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

    // Fallback: auto-pick best 11 by overall
    const sorted = [...available].sort((a, b) => b.overall - a.overall);
    return sorted.slice(0, 11);
  }

  function calculateTeamStrength(team) {
    const available = team.players.filter(p => p.injured === 0);
    if (available.length < 11) return 30; // penalty for insufficient players

    const starting = getStartingEleven(team);

    let strength = 0;
    for (const p of starting) {
      strength += p.overall;
    }
    strength /= 11;

    // Midfield loading bonus (famous game quirk!)
    const mids = starting.filter(p => p.position === 'MID').length;
    if (mids >= 5) strength += 5;
    if (mids >= 6) strength += 3;

    // Formation bonus (if enabled)
    if (state && state.options && state.options.formationStrategy && team.formation) {
      const formation = FORMATIONS[team.formation];
      if (formation && formation.bonus) {
        for (const [pos, bonus] of Object.entries(formation.bonus)) {
          const posCount = starting.filter(p => p.position === pos).length;
          const idealCount = formation[pos] || 0;
          if (posCount >= idealCount) {
            strength += bonus;
          }
        }
      }
    }

    // Coach bonus
    const coachQ = team.staff.Coach.quality;
    strength += coachQ * 2;

    // Pitch bonus
    const pitchLevel = team.ground.pitch;
    strength += pitchLevel;

    // Morale
    const avgMorale = starting.reduce((s, p) => s + p.morale, 0) / starting.length;
    strength += (avgMorale - 50) / 10;

    return Math.max(10, strength);
  }

  function simulateMatch(homeTeam, awayTeam) {
    const homeStr = calculateTeamStrength(homeTeam);
    const awayStr = calculateTeamStrength(awayTeam);

    // Home advantage
    const homeAdv = 5;
    const homeFinal = homeStr + homeAdv;
    const awayFinal = awayStr;

    // Goal probability based on strength difference
    const total = homeFinal + awayFinal;
    const homeProb = homeFinal / total;

    // Generate goals (Poisson-ish)
    const totalGoals = Math.floor(Math.random() * 4) + Math.floor(Math.random() * 2);
    let homeGoals = 0;
    let awayGoals = 0;

    for (let i = 0; i < totalGoals; i++) {
      if (Math.random() < homeProb) {
        homeGoals++;
      } else {
        awayGoals++;
      }
    }

    // Small chance of high-scoring game
    if (Math.random() < 0.1) {
      homeGoals += Math.floor(Math.random() * 3);
      awayGoals += Math.floor(Math.random() * 2);
    }

    return { homeGoals, awayGoals };
  }

  function recordFinance(team, type, amount, label) {
    if (!team.isHuman || !state.weeklyFinances) return;
    // Find the human team index
    for (const hp of state.humanPlayers) {
      if (hp.sacked) continue;
      const t = state.divisions[hp.division].teams[hp.teamIndex];
      if (t === team && state.weeklyFinances[hp.teamIndex]) {
        state.weeklyFinances[hp.teamIndex].push({ type, amount, label });
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
    for (const hp of state.humanPlayers) {
      if (hp.sacked) continue;
      state.weeklyFinances[hp.teamIndex] = [];
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

    // Youth coach training (if enabled) — trains academy prospects each week
    if (state.options.youthAcademy && state.youthAcademy && state.youthAcademyData) {
      for (let i = 0; i < state.humanPlayers.length; i++) {
        if (state.humanPlayers[i].sacked) continue;
        const ad = state.youthAcademyData[i];
        if (!ad || ad.youthCoach <= 0) continue;
        const academy = state.youthAcademy[i];
        if (!academy) continue;
        const coachBonus = MTSM_DATA.YOUTH_COACH_QUALITY.trainBonus[ad.youthCoach];
        for (const player of academy) {
          // Youth coach trains targeted skill if set, otherwise random
          const skill = player.training || MTSM_DATA.pick(MTSM_DATA.SKILLS);
          const trainChance = 0.15 + coachBonus;
          if (Math.random() < trainChance) {
            const oldSkill = player.skills[skill];
            player.skills[skill] = Math.min(99, player.skills[skill] + 1);
            player.overall = Math.round(
              Object.values(player.skills).reduce((a, b) => a + b, 0) / MTSM_DATA.SKILLS.length
            );
            // Recalculate value
            const ageMult = player.age <= 22 ? 1.3 - (player.age - 17) * 0.04 : 1.0;
            player.value = Math.round(player.overall * 10000 * ageMult * 0.3);
            pushNews({ type: 'ACADEMY', text: `Youth prospect ${player.name} improved ${skill} (${oldSkill}→${player.skills[skill]}) in academy training.` });
          }
        }
      }
    }

    // Mid-season transfer market refresh
    const midPoint = Math.floor(state.divisions[0].fixtures.length / 2);
    if (state.week === midPoint && !state.midSeasonRefreshed) {
      const newPlayers = MTSM_DATA.generateTransferPool(30);
      state.transferPool = [...state.transferPool.slice(-150), ...newPlayers];
      state.midSeasonRefreshed = true;
      pushNews({ type: 'TRANSFER', text: 'The mid-season transfer window has opened with fresh players available!' });
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
        if (state.options.youthAcademy && team.isHuman && state.youthAcademyData) {
          const hpIdx = team.humanPlayerIndex;
          const ad = state.youthAcademyData[hpIdx];
          if (ad && ad.youthCoach > 0) {
            youthCoachWage = MTSM_DATA.YOUTH_COACH_QUALITY.costs[ad.youthCoach];
          }
        }
        team.balance -= playerWages + staffWages + youthCoachWage;
        team.weeklyWages = playerWages + staffWages + youthCoachWage;
        recordFinance(team, 'expense', playerWages + staffWages + youthCoachWage, 'Wages (players + staff)');
      }
    }
  }

  function processTraining() {
    for (let dIdx = 0; dIdx < state.divisions.length; dIdx++) {
      const div = state.divisions[dIdx];
      for (const team of div.teams) {
        const coachQ = team.staff.Coach.quality;
        for (const player of team.players) {
          if (player.training && player.injured === 0) {
            const oldSkill = player.skills[player.training];
            // Youth players with high potential train faster
            let trainChance = 0.3 + coachQ * 0.1;
            if (state.options.youthAcademy && player.isYouth && player.potential) {
              trainChance += (player.potential - 50) / 200; // e.g. pot 90 adds +0.2
              // Youth potential slowly becomes actual skill with age
              if (player.age <= 21 && player.overall < player.potential) {
                trainChance += 0.1; // extra youth boost
              }
            }
            const improvement = Math.random() < trainChance ? 1 : 0;
            const decline = Math.random() < 0.08 ? 1 : 0;
            player.skills[player.training] = Math.min(99, player.skills[player.training] + improvement);
            // Slight decline in untrained skills
            for (const sk of MTSM_DATA.SKILLS) {
              if (sk !== player.training && Math.random() < 0.03) {
                player.skills[sk] = Math.max(1, player.skills[sk] - decline);
              }
            }
            const oldOvr = player.overall;
            player.overall = Math.round(
              Object.values(player.skills).reduce((a, b) => a + b, 0) / MTSM_DATA.SKILLS.length
            );
            // Recalculate transfer value based on new overall
            const ageMult = player.age <= 22 ? 1.3 - (player.age - 17) * 0.04 : player.age <= 29 ? 1.0 : 1.0 - (player.age - 29) * 0.07;
            const divMult = [1.5, 1.2, 1.0, 0.8][dIdx] || 1.0;
            const youthMult = player.isYouth ? 0.3 : 1.0;
            player.value = Math.round(player.overall * 10000 * ageMult * divMult * youthMult);
            // Log training news for human teams
            if (team.isHuman && improvement > 0) {
              pushNews({ type: 'TRAINING', text: `${player.name} improved ${player.training} (${oldSkill}→${player.skills[player.training]}).` });
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
    if (teamObj.players.length >= 16) return { success: false, msg: 'Squad full (max 16 players).' };

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

  // ===== GROUND MANAGEMENT =====
  function upgradeGround(aspect, teamObj) {
    const upgrade = MTSM_DATA.GROUND_UPGRADES[aspect];
    const currentLevel = teamObj.ground[aspect];
    if (currentLevel >= upgrade.levels.length - 1) return { success: false, msg: 'Already at maximum.' };
    const cost = upgrade.costs[currentLevel + 1];
    if (teamObj.balance < cost) return { success: false, msg: `Insufficient funds. Need £${cost.toLocaleString()}.` };
    teamObj.balance -= cost;
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
            for (const sk of MTSM_DATA.SKILLS) {
              if (Math.random() < 0.3) {
                player.skills[sk] = Math.max(1, player.skills[sk] - MTSM_DATA.randInt(1, 3));
              }
            }
            player.overall = Math.round(
              Object.values(player.skills).reduce((a, b) => a + b, 0) / MTSM_DATA.SKILLS.length
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

    // Record club history for each human player before resetting stats
    for (let i = 0; i < state.humanPlayers.length; i++) {
      const hp = state.humanPlayers[i];
      if (hp.sacked) continue;
      const team = state.divisions[hp.division].teams[hp.teamIndex];
      const table = getLeagueTable(hp.division);
      const pos = table.findIndex(t => t.name === team.name) + 1;

      // Collect trophies won this season
      const trophies = [];
      // League champion (Division 1, position 1)
      if (hp.division === 0 && pos === 1) {
        trophies.push('League Champion');
      }
      // Division champion (top of any division)
      if (pos === 1 && hp.division > 0) {
        trophies.push(`Division ${hp.division + 1} Champion`);
      }
      // Cup trophies
      if (state.options.cupPrizeMoney) {
        if (state.cup && state.cup[hp.division] && state.cup[hp.division].winner === team.name) {
          trophies.push(`Division ${hp.division + 1} Cup`);
        }
        if (state.nationalCup && state.nationalCup.winner === team.name) {
          trophies.push('National Cup');
        }
        if (state.leagueTrophy && state.leagueTrophy.winner === team.name) {
          trophies.push('League Trophy');
        }
      }
      // League Joker trophy
      if (hp.division === 3 && pos === 16) {
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
        division: hp.division + 1,
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
      }
    }

    // Add new players to transfer market
    const newPlayers = MTSM_DATA.generateTransferPool(50);
    state.transferPool = [...state.transferPool.slice(-150), ...newPlayers];

    state.season++;
    state.week = 1;
    state.seasonOver = false;
    state.midSeasonRefreshed = false;

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

        let result = simulateMatch(homeTeam, awayTeam);
        // Cup match: if draw, away goals / extra time (just replay with slight home boost)
        if (result.homeGoals === result.awayGoals) {
          result.homeGoals += Math.random() < 0.55 ? 1 : 0;
          result.awayGoals += Math.random() < 0.45 ? 1 : 0;
          if (result.homeGoals === result.awayGoals) result.homeGoals++; // force a result
        }

        // Cup attendance & gate income (75% home, 25% away)
        const attendance = calculateAttendance(homeTeam, d);
        const ticketPrice = d === 0 ? 25 : d === 1 ? 18 : d === 2 ? 12 : 8;
        const gateIncome = attendance * ticketPrice;
        const homeShare = Math.floor(gateIncome * 0.75);
        const awayShare = Math.floor(gateIncome * 0.25);
        homeTeam.balance += homeShare;
        awayTeam.balance += awayShare;
        recordFinance(homeTeam, 'income', homeShare, `Div ${d + 1} Cup gate (home 75%)`);
        recordFinance(awayTeam, 'income', awayShare, `Div ${d + 1} Cup gate (away 25%)`);

        const winner = result.homeGoals > result.awayGoals ? match.home : match.away;
        const loser = winner === match.home ? match.away : match.home;
        match.played = true;
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

      let result = simulateMatch(homeTeam, awayTeam);
      // Knockout: no draws allowed
      if (result.homeGoals === result.awayGoals) {
        result.homeGoals += Math.random() < 0.55 ? 1 : 0;
        result.awayGoals += Math.random() < 0.45 ? 1 : 0;
        if (result.homeGoals === result.awayGoals) result.homeGoals++;
      }

      // Cup attendance & gate income (75% home, 25% away)
      const homeDivIdx = findTeamDivisionIndex(match.home);
      const attendance = calculateAttendance(homeTeam, homeDivIdx);
      const ticketPrice = homeDivIdx === 0 ? 25 : homeDivIdx === 1 ? 18 : homeDivIdx === 2 ? 12 : 8;
      const gateIncome = attendance * ticketPrice;
      const homeShare = Math.floor(gateIncome * 0.75);
      const awayShare = Math.floor(gateIncome * 0.25);
      homeTeam.balance += homeShare;
      awayTeam.balance += awayShare;
      recordFinance(homeTeam, 'income', homeShare, `${cupName} gate (home 75%)`);
      recordFinance(awayTeam, 'income', awayShare, `${cupName} gate (away 25%)`);

      const winner = result.homeGoals > result.awayGoals ? match.home : match.away;
      const loser = winner === match.home ? match.away : match.home;
      match.played = true;
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
      const skills = {};
      for (const sk of MTSM_DATA.SKILLS) {
        let val = baseSkill + MTSM_DATA.randInt(-8, 8);
        if (pos === 'GK' && (sk === 'Tackling' || sk === 'Heading')) val += 5;
        if (pos === 'DEF' && sk === 'Tackling') val += 5;
        if (pos === 'MID' && sk === 'Passing') val += 5;
        if (pos === 'FWD' && sk === 'Shooting') val += 5;
        skills[sk] = Math.max(1, Math.min(99, val));
      }
      const overall = Math.round(Object.values(skills).reduce((a, b) => a + b, 0) / MTSM_DATA.SKILLS.length);
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
    if (team.players.length >= 16) return { success: false, msg: 'Squad full (max 16 players).' };

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
    return { success: true, msg: `Formation set to ${formationName}.` };
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
    const sorted = [...available].sort((a, b) => b.overall - a.overall);
    const best11 = sorted.slice(0, 11);
    teamObj.startingXI = best11.map(p => p.id);
    return { success: true, msg: 'Auto-selected best 11 players.' };
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
    FORMATIONS,
    CUP_PRIZE_MONEY,
    NATIONAL_CUP_PRIZE_MONEY,
    LEAGUE_TROPHY_PRIZE_MONEY
  };

})();

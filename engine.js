/* ========= MTSM Game Engine ========= */
'use strict';

const MTSM_ENGINE = (() => {

  let state = null;

  function initGame(humanPlayers) {
    // humanPlayers = [{ name: 'Player 1', teamIndex: 0 }, ...]
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
    }

    const transferPool = MTSM_DATA.generateTransferPool(200);

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
        sacked: false
      })),
      phase: 'menu', // menu, match_day, end_season, game_over
      news: [],
      matchResults: [],
      seasonOver: false
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

  // ===== MATCH SIMULATION =====
  function calculateTeamStrength(team) {
    const available = team.players.filter(p => p.injured === 0);
    if (available.length < 11) return 30; // penalty for insufficient players

    // Pick best 11
    const sorted = [...available].sort((a, b) => b.overall - a.overall);
    const starting = sorted.slice(0, 11);

    let strength = 0;
    for (const p of starting) {
      strength += p.overall;
    }
    strength /= 11;

    // Midfield loading bonus (famous game quirk!)
    const mids = starting.filter(p => p.position === 'MID').length;
    if (mids >= 5) strength += 5;
    if (mids >= 6) strength += 3;

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

  function playMatchDay() {
    state.matchResults = [];
    state.news = [];

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

    // Check if any human is bankrupt
    for (const hp of state.humanPlayers) {
      if (hp.sacked) continue;
      const team = state.divisions[hp.division].teams[hp.teamIndex];
      if (team.balance < -50000) {
        hp.sacked = true;
        team.isHuman = false;
        state.news.push({
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
        team.balance -= playerWages + staffWages;
        team.weeklyWages = playerWages + staffWages;
      }
    }
  }

  function processTraining() {
    for (const div of state.divisions) {
      for (const team of div.teams) {
        const coachQ = team.staff.Coach.quality;
        for (const player of team.players) {
          if (player.training && player.injured === 0) {
            const improvement = Math.random() < (0.3 + coachQ * 0.1) ? 1 : 0;
            const decline = Math.random() < 0.08 ? 1 : 0;
            player.skills[player.training] = Math.min(99, player.skills[player.training] + improvement);
            // Slight decline in untrained skills
            for (const sk of MTSM_DATA.SKILLS) {
              if (sk !== player.training && Math.random() < 0.03) {
                player.skills[sk] = Math.max(1, player.skills[sk] - decline);
              }
            }
            player.overall = Math.round(
              Object.values(player.skills).reduce((a, b) => a + b, 0) / MTSM_DATA.SKILLS.length
            );
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
          eventText = eventTemplate.text.replace('{team}', team.name).replace('{amount}', fine.toLocaleString());
          break;
        }
        case 'tv': {
          const bonus = MTSM_DATA.randInt(eventTemplate.minBonus, eventTemplate.maxBonus);
          team.balance += bonus;
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
            state.transferPool.unshift(newPlayer);
            eventText = eventTemplate.text.replace('{player}', newPlayer.name);
          }
          break;
        }
        case 'sponsor': {
          const bonus = MTSM_DATA.randInt(eventTemplate.minBonus, eventTemplate.maxBonus);
          team.balance += bonus;
          eventText = eventTemplate.text.replace('{amount}', bonus.toLocaleString());
          break;
        }
      }

      if (eventText) {
        state.news.push({ type: eventTemplate.type.toUpperCase(), text: eventText });
      }
    }
  }

  // ===== TRANSFER ACTIONS =====
  function buyPlayer(playerId, teamObj) {
    const idx = state.transferPool.findIndex(p => p.id === playerId);
    if (idx === -1) return { success: false, msg: 'Player no longer available.' };
    if (teamObj.players.length >= 16) return { success: false, msg: 'Squad full (max 16 players).' };

    const player = state.transferPool[idx];
    if (teamObj.balance < player.askingPrice) return { success: false, msg: 'Insufficient funds.' };

    teamObj.balance -= player.askingPrice;
    delete player.askingPrice;
    teamObj.players.push(player);
    state.transferPool.splice(idx, 1);
    return { success: true, msg: `${player.name} signed for £${player.askingPrice ? player.askingPrice.toLocaleString() : ''}!` };
  }

  function sellPlayer(playerId, teamObj) {
    const idx = teamObj.players.findIndex(p => p.id === playerId);
    if (idx === -1) return { success: false, msg: 'Player not found.' };
    if (teamObj.players.length <= 11) return { success: false, msg: 'Cannot sell — need minimum 11 players.' };

    const player = teamObj.players[idx];
    const salePrice = Math.round(player.value * (0.7 + Math.random() * 0.5));
    teamObj.balance += salePrice;
    player.askingPrice = Math.round(salePrice * 1.2);
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
    return { success: true, msg: `${role} upgraded to ${MTSM_DATA.STAFF_QUALITIES[newQuality]}!` };
  }

  function downgradeStaff(role, teamObj) {
    const current = teamObj.staff[role];
    if (current.quality <= 0) return { success: false, msg: 'Already at minimum quality.' };
    const newQuality = current.quality - 1;
    const newWage = MTSM_DATA.STAFF_COSTS[newQuality];
    teamObj.staff[role] = { quality: newQuality, wage: newWage };
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
        state.news.push({
          type: 'TROPHY',
          text: `${lastTeam.name} wins the legendary "League Joker" trophy for finishing bottom of Division 4!`
        });
      }
    }

    // Execute promotions and relegations
    for (const promo of promotions) {
      moveTeamBetweenDivisions(promo.team, promo.fromDiv, promo.toDiv);
      state.news.push({
        type: 'PROMOTION',
        text: `${promo.team.name} promoted from Division ${promo.fromDiv + 1} to Division ${promo.toDiv + 1}!`
      });
    }

    for (const releg of relegations) {
      moveTeamBetweenDivisions(releg.team, releg.fromDiv, releg.toDiv);
      state.news.push({
        type: 'RELEGATION',
        text: `${releg.team.name} relegated from Division ${releg.fromDiv + 1} to Division ${releg.toDiv + 1}!`
      });
    }

    // Age players and retire old ones
    for (const div of state.divisions) {
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
        }
        // Auto-retire very old players
        const retired = team.players.filter(p => p.age >= 37);
        for (const r of retired) {
          state.news.push({ type: 'RETIREMENT', text: `${r.name} (${team.name}) retires at age ${r.age}.` });
        }
        team.players = team.players.filter(p => p.age < 37);

        // Auto-fill if team is short
        while (team.players.length < 14) {
          const divIdx = state.divisions.indexOf(div);
          team.players.push(MTSM_DATA.generatePlayer(divIdx));
        }
      }
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

    return { promotions, relegations, champion };
  }

  function moveTeamBetweenDivisions(team, fromDiv, toDiv) {
    const fromDivision = state.divisions[fromDiv];
    const toDivision = state.divisions[toDiv];

    const fromIdx = fromDivision.teams.indexOf(team);
    if (fromIdx === -1) return;

    // Find a team going the other way (already handled by paired promo/releg)
    // Just swap positions
    fromDivision.teams.splice(fromIdx, 1);
    toDivision.teams.push(team);

    // Update human player tracking
    for (const hp of state.humanPlayers) {
      if (hp.division === fromDiv) {
        const hpTeam = fromDivision.teams[hp.teamIndex];
        if (!hpTeam || hpTeam.name !== state.divisions[hp.division].teams[hp.teamIndex]?.name) {
          // Find team in new division
          const newIdx = toDivision.teams.findIndex(t => t.name === team.name);
          if (newIdx !== -1 && team.isHuman && team.humanPlayerIndex === hp.teamIndex) {
            hp.division = toDiv;
            hp.teamIndex = newIdx;
          }
        }
      }
    }

    // Fix human player indices after move
    for (const hp of state.humanPlayers) {
      if (hp.sacked) continue;
      const div = state.divisions[hp.division];
      const idx = div.teams.findIndex(t => t.isHuman && t.humanName === hp.name);
      if (idx !== -1) {
        hp.teamIndex = idx;
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

  // ===== SAVE / LOAD =====
  function saveGame() {
    if (!state) return null;
    return JSON.parse(JSON.stringify(state)); // deep clone
  }

  function loadGame(savedState) {
    if (!savedState || !savedState.divisions) return false;
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
    loadGame
  };

})();

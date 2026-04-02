/* ========= MTSM AI-Only Simulation Runner ========= */
/* Developer-only tool for studying AI personality behaviour over many seasons.
   Not linked from index.html — load via simulation.html or browser console. */
'use strict';

const MTSM_SIM = (() => {

  // ===== Configuration Defaults =====
  const DEFAULT_CONFIG = {
    seasons: 100,
    // Personality distribution: how many of each type across 64 teams
    // null = random assignment (engine default)
    personalityDistribution: null,
    // Example fixed distribution: { pragmatist: 13, tactician: 13, moneybag: 13, developer: 13, gambler: 12 }
    enableFormations: true,
    enableCups: true,
    // Flush AI log every N seasons to prevent memory bloat
    logFlushInterval: 1,
    // Progress callback: called each season with (seasonNumber, totalSeasons)
    onProgress: null,
    // Seed for reproducibility (0 = use Math.random default)
    seed: 0
  };

  // ===== Data Collectors =====

  function createCollector() {
    return {
      // Per-season division snapshots: [{season, divisions: [{name, table: [{team, points, ...}]}]}]
      seasonSnapshots: [],
      // Per-team tracking across all seasons
      teamHistories: {},   // teamName -> [{season, division, position, points, gd, balance, squadOvr, avgAge, ...}]
      // Per-personality aggregates
      personalityStats: {}, // personalityKey -> {seasons, totalPoints, promotions, relegations, titles, cups, ...}
      // Head-to-head personality matchup data
      matchups: {},        // 'personality1_vs_personality2' -> {wins1, draws, wins2}
      // Financial tracking
      financialHistory: {}, // teamName -> [{season, balance, totalWages}]
      // Division mobility tracking
      divisionMobility: [], // [{season, movements: [{team, from, to, personality}]}]
      // Championship and trophy records
      trophyLog: [],       // [{season, trophy, team, personality}]
      // AI decision summaries (flushed periodically)
      decisionSummaries: {}, // teamName -> {buys, sells, emergencySells, panicBuys, staffUpgrades, ...}
      // Match engine stats
      matchStats: { totalGoals: 0, totalMatches: 0, homeWins: 0, awayWins: 0, draws: 0 }
    };
  }

  function snapshotSeason(state, collector, personalityMap) {
    const season = state.season;
    const divisionData = [];

    for (let d = 0; d < 4; d++) {
      const table = MTSM_ENGINE.getLeagueTable(d);
      const tableData = table.map((team, idx) => {
        const personality = personalityMap[team.name] || 'unknown';
        const avgOvr = team.players.length > 0
          ? Math.round(team.players.reduce((s, p) => s + p.overall, 0) / team.players.length)
          : 0;
        const avgAge = team.players.length > 0
          ? +(team.players.reduce((s, p) => s + p.age, 0) / team.players.length).toFixed(1)
          : 0;

        // Record team history
        if (!collector.teamHistories[team.name]) collector.teamHistories[team.name] = [];
        collector.teamHistories[team.name].push({
          season, division: d + 1, position: idx + 1,
          points: team.points, won: team.won, drawn: team.drawn, lost: team.lost,
          goalsFor: team.goalsFor, goalsAgainst: team.goalsAgainst,
          gd: team.goalsFor - team.goalsAgainst,
          balance: team.balance, squadSize: team.players.length,
          avgOvr, avgAge, personality
        });

        // Record financial history
        if (!collector.financialHistory[team.name]) collector.financialHistory[team.name] = [];
        collector.financialHistory[team.name].push({
          season, balance: team.balance,
          totalWages: team.weeklyWages,
          squadSize: team.players.length
        });

        // Personality aggregate stats
        if (!collector.personalityStats[personality]) {
          collector.personalityStats[personality] = {
            seasons: 0, totalPoints: 0, totalWon: 0, totalDrawn: 0, totalLost: 0,
            totalGF: 0, totalGA: 0, promotions: 0, relegations: 0,
            div1Titles: 0, divTitles: 0, cupWins: 0, nationalCupWins: 0,
            leagueTrophyWins: 0, bankruptcies: 0,
            avgBalance: 0, balanceSum: 0,
            avgOvrSum: 0, avgAgeSum: 0,
            positionSum: 0, positionCount: 0,
            divisionDistribution: { 1: 0, 2: 0, 3: 0, 4: 0 },
            bestFinish: { division: 4, position: 16 },
            worstFinish: { division: 1, position: 1 }
          };
        }
        const ps = collector.personalityStats[personality];
        ps.seasons++;
        ps.totalPoints += team.points;
        ps.totalWon += team.won;
        ps.totalDrawn += team.drawn;
        ps.totalLost += team.lost;
        ps.totalGF += team.goalsFor;
        ps.totalGA += team.goalsAgainst;
        ps.balanceSum += team.balance;
        ps.avgOvrSum += avgOvr;
        ps.avgAgeSum += avgAge;
        ps.positionSum += (idx + 1);
        ps.positionCount++;
        ps.divisionDistribution[d + 1]++;

        if (team.balance < -50000) ps.bankruptcies++;

        // Best finish (lower division number + lower position = better)
        const finishScore = (d + 1) * 100 + (idx + 1);
        const bestScore = ps.bestFinish.division * 100 + ps.bestFinish.position;
        if (finishScore < bestScore) ps.bestFinish = { division: d + 1, position: idx + 1 };
        const worstScore = ps.worstFinish.division * 100 + ps.worstFinish.position;
        if (finishScore > worstScore) ps.worstFinish = { division: d + 1, position: idx + 1 };

        // Titles
        if (d === 0 && idx === 0) {
          ps.div1Titles++;
          collector.trophyLog.push({ season, trophy: 'League Champion', team: team.name, personality });
        }
        if (idx === 0 && d > 0) {
          ps.divTitles++;
          collector.trophyLog.push({ season, trophy: `Division ${d + 1} Champion`, team: team.name, personality });
        }

        return {
          team: team.name, personality, position: idx + 1,
          points: team.points, gd: team.goalsFor - team.goalsAgainst,
          balance: team.balance, avgOvr, avgAge
        };
      });

      divisionData.push({ name: `Division ${d + 1}`, table: tableData });
    }

    // Cup trophies
    if (state.options.cupPrizeMoney) {
      for (let d = 0; d < 4; d++) {
        if (state.cup && state.cup[d] && state.cup[d].winner) {
          const p = personalityMap[state.cup[d].winner] || 'unknown';
          const ps = collector.personalityStats[p];
          if (ps) ps.cupWins++;
          collector.trophyLog.push({ season, trophy: `Division ${d + 1} Cup`, team: state.cup[d].winner, personality: p });
        }
      }
      if (state.nationalCup && state.nationalCup.winner) {
        const p = personalityMap[state.nationalCup.winner] || 'unknown';
        const ps = collector.personalityStats[p];
        if (ps) ps.nationalCupWins++;
        collector.trophyLog.push({ season, trophy: 'National Cup', team: state.nationalCup.winner, personality: p });
      }
      if (state.leagueTrophy && state.leagueTrophy.winner) {
        const p = personalityMap[state.leagueTrophy.winner] || 'unknown';
        const ps = collector.personalityStats[p];
        if (ps) ps.leagueTrophyWins++;
        collector.trophyLog.push({ season, trophy: 'League Trophy', team: state.leagueTrophy.winner, personality: p });
      }
    }

    collector.seasonSnapshots.push({ season, divisions: divisionData });
  }

  function collectMatchStats(state, collector) {
    // Aggregate match results from the current week
    for (const divRes of state.matchResults) {
      for (const r of divRes.results) {
        collector.matchStats.totalMatches++;
        collector.matchStats.totalGoals += r.homeGoals + r.awayGoals;
        if (r.homeGoals > r.awayGoals) collector.matchStats.homeWins++;
        else if (r.awayGoals > r.homeGoals) collector.matchStats.awayWins++;
        else collector.matchStats.draws++;
      }
    }
  }

  function collectPromotionRelegation(result, collector, personalityMap) {
    const movements = [];
    for (const promo of result.promotions) {
      const p = personalityMap[promo.team.name] || 'unknown';
      movements.push({ team: promo.team.name, from: promo.fromDiv + 1, to: promo.toDiv + 1, type: 'promotion', personality: p });
      const ps = collector.personalityStats[p];
      if (ps) ps.promotions++;
    }
    for (const releg of result.relegations) {
      const p = personalityMap[releg.team.name] || 'unknown';
      movements.push({ team: releg.team.name, from: releg.fromDiv + 1, to: releg.toDiv + 1, type: 'relegation', personality: p });
      const ps = collector.personalityStats[p];
      if (ps) ps.relegations++;
    }
    collector.divisionMobility.push({ season: MTSM_ENGINE.getState().season - 1, movements });
  }

  function flushAILog(collector, personalityMap) {
    const state = MTSM_ENGINE.getState();
    const log = (state && state.aiManagerLog) ? state.aiManagerLog : [];
    for (const entry of log) {
      const team = entry.team;
      if (!collector.decisionSummaries[team]) {
        collector.decisionSummaries[team] = {
          personality: personalityMap[team] || 'unknown',
          buys: 0, sells: 0, emergencySells: 0, panicBuys: 0,
          staffUpgrades: 0, groundUpgrades: 0, formationChanges: 0,
          trainingRefreshes: 0, squadFills: 0
        };
      }
      const ds = collector.decisionSummaries[team];
      switch (entry.action) {
        case 'buy': ds.buys++; break;
        case 'sell': ds.sells++; break;
        case 'emergency_sell': ds.emergencySells++; break;
        case 'panic_buy': ds.panicBuys++; break;
        case 'staff_upgrade': ds.staffUpgrades++; break;
        case 'ground_upgrade': ds.groundUpgrades++; break;
        case 'formation_change': ds.formationChanges++; break;
        case 'training': ds.trainingRefreshes++; break;
        case 'squad_fill': ds.squadFills++; break;
      }
    }
    // Clear the log to free memory
    if (state) state.aiManagerLog = [];
  }

  // ===== Personality Map Builder =====

  function buildPersonalityMap(state) {
    const map = {};
    if (state.aiManagerData) {
      for (const [teamName, data] of Object.entries(state.aiManagerData)) {
        map[teamName] = data.personality;
      }
    }
    return map;
  }

  // ===== Custom Personality Distribution =====

  function applyPersonalityDistribution(state, distribution) {
    if (!distribution || !state.aiManagerData) return;

    const types = MTSM_DATA.AI_MANAGER_TYPES;
    const typeMap = {};
    for (const t of types) typeMap[t.key] = t;

    // Build assignment queue from distribution
    const queue = [];
    for (const [key, count] of Object.entries(distribution)) {
      for (let i = 0; i < count; i++) queue.push(key);
    }

    // Shuffle queue
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    // Assign to teams
    const teamNames = Object.keys(state.aiManagerData);
    for (let i = 0; i < teamNames.length && i < queue.length; i++) {
      const teamName = teamNames[i];
      const personalityKey = queue[i];
      const personality = typeMap[personalityKey];
      if (!personality) continue;

      state.aiManagerData[teamName].personality = personalityKey;

      // Re-apply formation and training for new personality
      for (let d = 0; d < 4; d++) {
        const team = state.divisions[d].teams.find(t => t.name === teamName);
        if (team) {
          if (state.options.formationStrategy) {
            team.formation = personality.preferredFormation;
          }
          break;
        }
      }
    }
  }

  // ===== Report Generators =====

  function generateReports(collector, config) {
    return {
      summary: generateSummaryReport(collector, config),
      personalityComparison: generatePersonalityComparison(collector),
      divisionDominance: generateDivisionDominance(collector),
      dynasties: generateDynasties(collector),
      financialReport: generateFinancialReport(collector),
      matchEngineReport: generateMatchEngineReport(collector),
      mobilityReport: generateMobilityReport(collector),
      trophyReport: generateTrophyReport(collector),
      decisionReport: generateDecisionReport(collector)
    };
  }

  function generateSummaryReport(collector, config) {
    const totalSeasons = collector.seasonSnapshots.length;
    return {
      title: 'AI-Only Simulation Summary',
      seasonsSimulated: totalSeasons,
      totalMatches: collector.matchStats.totalMatches,
      totalGoals: collector.matchStats.totalGoals,
      avgGoalsPerMatch: collector.matchStats.totalMatches > 0
        ? +(collector.matchStats.totalGoals / collector.matchStats.totalMatches).toFixed(2)
        : 0,
      homeWinPct: collector.matchStats.totalMatches > 0
        ? +(collector.matchStats.homeWins / collector.matchStats.totalMatches * 100).toFixed(1)
        : 0,
      awayWinPct: collector.matchStats.totalMatches > 0
        ? +(collector.matchStats.awayWins / collector.matchStats.totalMatches * 100).toFixed(1)
        : 0,
      drawPct: collector.matchStats.totalMatches > 0
        ? +(collector.matchStats.draws / collector.matchStats.totalMatches * 100).toFixed(1)
        : 0,
      teamsTracked: Object.keys(collector.teamHistories).length,
      personalitiesTracked: Object.keys(collector.personalityStats).length
    };
  }

  function generatePersonalityComparison(collector) {
    const rows = [];
    for (const [key, ps] of Object.entries(collector.personalityStats)) {
      const type = MTSM_DATA.AI_MANAGER_TYPES.find(t => t.key === key);
      const n = ps.positionCount || 1;
      rows.push({
        personality: key,
        label: type ? type.label : key,
        icon: type ? type.icon : '?',
        teamSeasons: ps.seasons,
        avgPoints: +(ps.totalPoints / n).toFixed(1),
        avgPosition: +(ps.positionSum / n).toFixed(1),
        winRate: +((ps.totalWon / (ps.totalWon + ps.totalDrawn + ps.totalLost)) * 100).toFixed(1),
        drawRate: +((ps.totalDrawn / (ps.totalWon + ps.totalDrawn + ps.totalLost)) * 100).toFixed(1),
        lossRate: +((ps.totalLost / (ps.totalWon + ps.totalDrawn + ps.totalLost)) * 100).toFixed(1),
        avgGD: +((ps.totalGF - ps.totalGA) / n).toFixed(1),
        promotions: ps.promotions,
        relegations: ps.relegations,
        promotionRate: +(ps.promotions / n * 100).toFixed(1),
        relegationRate: +(ps.relegations / n * 100).toFixed(1),
        div1Titles: ps.div1Titles,
        divTitles: ps.divTitles,
        cupWins: ps.cupWins,
        nationalCupWins: ps.nationalCupWins,
        leagueTrophyWins: ps.leagueTrophyWins,
        totalTrophies: ps.div1Titles + ps.divTitles + ps.cupWins + ps.nationalCupWins + ps.leagueTrophyWins,
        avgBalance: Math.round(ps.balanceSum / n),
        avgSquadOvr: +(ps.avgOvrSum / n).toFixed(1),
        avgSquadAge: +(ps.avgAgeSum / n).toFixed(1),
        bankruptcies: ps.bankruptcies,
        bestFinish: ps.bestFinish,
        worstFinish: ps.worstFinish,
        divisionDistribution: {
          div1Pct: +(ps.divisionDistribution[1] / n * 100).toFixed(1),
          div2Pct: +(ps.divisionDistribution[2] / n * 100).toFixed(1),
          div3Pct: +(ps.divisionDistribution[3] / n * 100).toFixed(1),
          div4Pct: +(ps.divisionDistribution[4] / n * 100).toFixed(1)
        }
      });
    }
    // Sort by avg points descending
    rows.sort((a, b) => b.avgPoints - a.avgPoints);
    return { title: 'Personality Comparison', rows };
  }

  function generateDivisionDominance(collector) {
    // For each season, which personality type had the most teams in Div 1?
    const seasonData = collector.seasonSnapshots.map(snap => {
      const div1 = snap.divisions[0].table;
      const counts = {};
      for (const entry of div1) {
        counts[entry.personality] = (counts[entry.personality] || 0) + 1;
      }
      return { season: snap.season, div1Personalities: counts };
    });
    return { title: 'Division 1 Dominance Over Time', data: seasonData };
  }

  function generateDynasties(collector) {
    // Find teams with longest consecutive runs in Div 1
    const dynasties = [];
    for (const [teamName, history] of Object.entries(collector.teamHistories)) {
      let currentRun = 0;
      let bestRun = 0;
      let bestRunStart = 0;
      let titleCount = 0;

      for (const h of history) {
        if (h.division === 1) {
          currentRun++;
          if (currentRun > bestRun) {
            bestRun = currentRun;
            bestRunStart = h.season - currentRun + 1;
          }
          if (h.position === 1) titleCount++;
        } else {
          currentRun = 0;
        }
      }

      if (bestRun >= 3) {
        dynasties.push({
          team: teamName,
          personality: history[0]?.personality || 'unknown',
          consecutiveDiv1Seasons: bestRun,
          startSeason: bestRunStart,
          titles: titleCount
        });
      }
    }
    dynasties.sort((a, b) => b.consecutiveDiv1Seasons - a.consecutiveDiv1Seasons);
    return { title: 'Dynasty Rankings (3+ consecutive Div 1 seasons)', dynasties: dynasties.slice(0, 20) };
  }

  function generateFinancialReport(collector) {
    // Aggregate financial health by personality
    const byPersonality = {};
    for (const [teamName, history] of Object.entries(collector.financialHistory)) {
      const teamHist = collector.teamHistories[teamName];
      if (!teamHist || teamHist.length === 0) continue;
      const personality = teamHist[0].personality;
      if (!byPersonality[personality]) {
        byPersonality[personality] = { totalBalance: 0, count: 0, negativeCount: 0, maxBalance: -Infinity, minBalance: Infinity };
      }
      for (const h of history) {
        byPersonality[personality].totalBalance += h.balance;
        byPersonality[personality].count++;
        if (h.balance < 0) byPersonality[personality].negativeCount++;
        if (h.balance > byPersonality[personality].maxBalance) byPersonality[personality].maxBalance = h.balance;
        if (h.balance < byPersonality[personality].minBalance) byPersonality[personality].minBalance = h.balance;
      }
    }

    const rows = [];
    for (const [key, data] of Object.entries(byPersonality)) {
      rows.push({
        personality: key,
        avgBalance: Math.round(data.totalBalance / data.count),
        maxBalance: data.maxBalance,
        minBalance: data.minBalance,
        negativeBalancePct: +(data.negativeCount / data.count * 100).toFixed(1)
      });
    }
    rows.sort((a, b) => b.avgBalance - a.avgBalance);
    return { title: 'Financial Health by Personality', rows };
  }

  function generateMatchEngineReport(collector) {
    const ms = collector.matchStats;
    return {
      title: 'Match Engine Statistics',
      totalMatches: ms.totalMatches,
      totalGoals: ms.totalGoals,
      avgGoalsPerMatch: ms.totalMatches > 0 ? +(ms.totalGoals / ms.totalMatches).toFixed(2) : 0,
      homeWins: ms.homeWins,
      awayWins: ms.awayWins,
      draws: ms.draws,
      homeWinPct: ms.totalMatches > 0 ? +(ms.homeWins / ms.totalMatches * 100).toFixed(1) : 0,
      awayWinPct: ms.totalMatches > 0 ? +(ms.awayWins / ms.totalMatches * 100).toFixed(1) : 0,
      drawPct: ms.totalMatches > 0 ? +(ms.draws / ms.totalMatches * 100).toFixed(1) : 0
    };
  }

  function generateMobilityReport(collector) {
    // How often teams change divisions
    const byPersonality = {};
    for (const seasonMov of collector.divisionMobility) {
      for (const m of seasonMov.movements) {
        if (!byPersonality[m.personality]) byPersonality[m.personality] = { promotions: 0, relegations: 0 };
        if (m.type === 'promotion') byPersonality[m.personality].promotions++;
        else byPersonality[m.personality].relegations++;
      }
    }

    // Bounce rate: promoted then immediately relegated next season (or vice versa)
    const bounces = {};
    for (const [teamName, history] of Object.entries(collector.teamHistories)) {
      const personality = history[0]?.personality || 'unknown';
      if (!bounces[personality]) bounces[personality] = { promoBounce: 0, relegBounce: 0, promoTotal: 0, relegTotal: 0 };
      for (let i = 1; i < history.length - 1; i++) {
        const prev = history[i - 1];
        const curr = history[i];
        const next = history[i + 1];
        // Promoted then relegated
        if (curr.division < prev.division) {
          bounces[personality].promoTotal++;
          if (next.division > curr.division) bounces[personality].promoBounce++;
        }
        // Relegated then promoted
        if (curr.division > prev.division) {
          bounces[personality].relegTotal++;
          if (next.division < curr.division) bounces[personality].relegBounce++;
        }
      }
    }

    const rows = [];
    for (const [key, data] of Object.entries(byPersonality)) {
      const b = bounces[key] || { promoBounce: 0, relegBounce: 0, promoTotal: 0, relegTotal: 0 };
      rows.push({
        personality: key,
        promotions: data.promotions,
        relegations: data.relegations,
        promoBounceRate: b.promoTotal > 0 ? +(b.promoBounce / b.promoTotal * 100).toFixed(1) : 0,
        relegBounceRate: b.relegTotal > 0 ? +(b.relegBounce / b.relegTotal * 100).toFixed(1) : 0
      });
    }
    return { title: 'Division Mobility & Bounce Rates', rows };
  }

  function generateTrophyReport(collector) {
    // Trophies by personality
    const byPersonality = {};
    for (const t of collector.trophyLog) {
      if (!byPersonality[t.personality]) byPersonality[t.personality] = {};
      byPersonality[t.personality][t.trophy] = (byPersonality[t.personality][t.trophy] || 0) + 1;
    }

    // Most decorated teams
    const teamTrophies = {};
    for (const t of collector.trophyLog) {
      teamTrophies[t.team] = (teamTrophies[t.team] || 0) + 1;
    }
    const topTeams = Object.entries(teamTrophies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([team, count]) => {
        const hist = collector.teamHistories[team];
        return { team, trophies: count, personality: hist?.[0]?.personality || 'unknown' };
      });

    return { title: 'Trophy Distribution', byPersonality, topTeams };
  }

  function generateDecisionReport(collector) {
    // Aggregate AI decisions by personality
    const byPersonality = {};
    for (const [teamName, ds] of Object.entries(collector.decisionSummaries)) {
      const p = ds.personality;
      if (!byPersonality[p]) {
        byPersonality[p] = {
          teams: 0, buys: 0, sells: 0, emergencySells: 0, panicBuys: 0,
          staffUpgrades: 0, groundUpgrades: 0, formationChanges: 0,
          trainingRefreshes: 0, squadFills: 0
        };
      }
      const bp = byPersonality[p];
      bp.teams++;
      bp.buys += ds.buys;
      bp.sells += ds.sells;
      bp.emergencySells += ds.emergencySells;
      bp.panicBuys += ds.panicBuys;
      bp.staffUpgrades += ds.staffUpgrades;
      bp.groundUpgrades += ds.groundUpgrades;
      bp.formationChanges += ds.formationChanges;
      bp.trainingRefreshes += ds.trainingRefreshes;
      bp.squadFills += ds.squadFills;
    }

    // Calculate per-team averages
    const rows = [];
    for (const [key, data] of Object.entries(byPersonality)) {
      const n = data.teams || 1;
      rows.push({
        personality: key,
        teams: data.teams,
        avgBuys: +(data.buys / n).toFixed(1),
        avgSells: +(data.sells / n).toFixed(1),
        avgEmergencySells: +(data.emergencySells / n).toFixed(1),
        avgPanicBuys: +(data.panicBuys / n).toFixed(1),
        avgStaffUpgrades: +(data.staffUpgrades / n).toFixed(1),
        avgGroundUpgrades: +(data.groundUpgrades / n).toFixed(1),
        avgFormationChanges: +(data.formationChanges / n).toFixed(1),
        totalBuys: data.buys,
        totalSells: data.sells,
        totalPanicBuys: data.panicBuys,
        totalEmergencySells: data.emergencySells
      });
    }
    return { title: 'AI Decision-Making Summary', rows };
  }

  // ===== Cinderella Stories & Collapse Detection =====

  function generateSpecialStories(collector) {
    const stories = { cinderellas: [], collapses: [], longestClimbs: [] };

    for (const [teamName, history] of Object.entries(collector.teamHistories)) {
      if (history.length < 4) continue;

      // Cinderella: Div 4 to Div 1
      let inDiv4Season = null;
      for (const h of history) {
        if (h.division === 4 && inDiv4Season === null) inDiv4Season = h.season;
        if (h.division === 1 && inDiv4Season !== null) {
          stories.cinderellas.push({
            team: teamName, personality: h.personality,
            startSeason: inDiv4Season, arrivedDiv1: h.season,
            seasonsToClimb: h.season - inDiv4Season
          });
          inDiv4Season = null;
        }
        if (h.division === 4) inDiv4Season = h.season;
      }

      // Collapse: Div 1 to Div 4
      let inDiv1Season = null;
      for (const h of history) {
        if (h.division === 1 && inDiv1Season === null) inDiv1Season = h.season;
        if (h.division === 4 && inDiv1Season !== null) {
          stories.collapses.push({
            team: teamName, personality: h.personality,
            startSeason: inDiv1Season, arrivedDiv4: h.season,
            seasonsToFall: h.season - inDiv1Season
          });
          inDiv1Season = null;
        }
        if (h.division === 1) inDiv1Season = h.season;
      }
    }

    stories.cinderellas.sort((a, b) => a.seasonsToClimb - b.seasonsToClimb);
    stories.collapses.sort((a, b) => a.seasonsToFall - b.seasonsToFall);

    return stories;
  }

  // ===== Main Simulation Runner =====

  async function runSimulation(userConfig) {
    const config = { ...DEFAULT_CONFIG, ...userConfig };
    const collector = createCollector();

    // Seed the PRNG if requested
    if (config.seed) {
      MTSM_DATA.setSeed(config.seed);
    }

    // Initialize game with 0 human players, all options enabled
    MTSM_ENGINE.initGame([], {
      boardConfidence: false,   // No human players to sack
      formationStrategy: config.enableFormations,
      youthAcademy: false,      // Youth academy is human-only in the engine
      negotiation: false,       // AI uses direct buys
      cupPrizeMoney: config.enableCups,
      aiManagers: true
    });

    const state = MTSM_ENGINE.getState();

    // Apply custom personality distribution if provided
    if (config.personalityDistribution) {
      applyPersonalityDistribution(state, config.personalityDistribution);
    }

    // Build personality lookup map
    const personalityMap = buildPersonalityMap(state);

    const startTime = performance.now();

    for (let s = 1; s <= config.seasons; s++) {
      // Run one full season (30 match days)
      while (!state.seasonOver) {
        MTSM_ENGINE.playMatchDay();
        collectMatchStats(state, collector);
      }

      // Snapshot before end-of-season processing
      snapshotSeason(state, collector, personalityMap);

      // Flush AI log periodically
      if (s % config.logFlushInterval === 0) {
        flushAILog(collector, personalityMap);
      }

      // Process end of season (promotions, relegations, aging, etc.)
      const result = MTSM_ENGINE.processEndOfSeason();
      collectPromotionRelegation(result, collector, personalityMap);

      // Progress callback
      if (config.onProgress) {
        config.onProgress(s, config.seasons);
      }

      // Yield to browser event loop every 5 seasons to prevent freeze
      if (s % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Final AI log flush
    flushAILog(collector, personalityMap);

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

    // Generate all reports
    const reports = generateReports(collector, config);
    reports.specialStories = generateSpecialStories(collector);
    reports.meta = {
      simulationTime: `${elapsed}s`,
      config: {
        seasons: config.seasons,
        enableFormations: config.enableFormations,
        enableCups: config.enableCups,
        seed: config.seed,
        personalityDistribution: config.personalityDistribution
      }
    };

    return {
      reports,
      rawData: collector
    };
  }

  // ===== Public API =====
  return {
    runSimulation,
    DEFAULT_CONFIG
  };

})();

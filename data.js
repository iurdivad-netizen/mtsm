/* ========= MTSM Data Layer ========= */
'use strict';

const MTSM_DATA = (() => {

  // 64 English football-style team names across 4 divisions
  const TEAM_NAMES = [
    // Division 1 (top)
    'Ashford United','Blackmoor City','Chelston Town','Darfield Rovers',
    'Eastham Athletic','Foxwell Rangers','Greendale Wanderers','Hartlepool Borough',
    'Ironbridge Town','Jesmond City','Kingsley United','Langford Athletic',
    'Merton Town','Northfield Rangers','Oakham Wanderers','Penridge City',
    // Division 2
    'Queensbury Town','Redhill United','Stanwick City','Thornbury Athletic',
    'Upton Park Rangers','Valebridge Wanderers','Westbury Town','Yarmouth Borough',
    'Ainsley United','Bramley City','Carlford Town','Dunmore Athletic',
    'Elmfield Rangers','Finchley Wanderers','Grantley Town','Haverstock Borough',
    // Division 3
    'Inglebury United','Jarrow City','Kelston Town','Lindfield Athletic',
    'Manorfield Rangers','Newbury Wanderers','Oldfield Town','Paxford Borough',
    'Quinton United','Ravensfield City','Southdale Town','Trentham Athletic',
    'Underhill Rangers','Valleyfield Wanderers','Woodbridge Town','Exeter Borough',
    // Division 4 (bottom — where human players start)
    'Ashdale United','Brookfield City','Crossway Town','Dalton Athletic',
    'Edgewood Rangers','Fairfield Wanderers','Gateley Town','Hillcrest Borough',
    'Ivydale United','Kingsway City','Larchwood Town','Moorgate Athletic',
    'Netherfield Rangers','Oakley Wanderers','Pinewood Town','Riverside Borough'
  ];

  const FIRST_NAMES = [
    'James','John','Robert','Michael','David','Richard','Thomas','William',
    'Chris','Daniel','Matthew','Andrew','Mark','Paul','Steven','Brian',
    'Kevin','Gary','Ian','Peter','Alan','Neil','Tony','Stuart',
    'Craig','Lee','Martin','Stephen','Scott','Jason','Simon','Wayne',
    'Jamie','Ryan','Dean','Nathan','Adam','Karl','Joe','Luke',
    'Sean','Ben','Danny','Kyle','Connor','Harry','Jack','Ollie',
    'Liam','George','Charlie','Alfie','Sam','Billy','Frank','Eddie',
    'Tommy','Arthur','Fred','Archie','Reg','Albert','Harold','Ray'
  ];

  const LAST_NAMES = [
    'Smith','Jones','Taylor','Williams','Brown','Davies','Wilson','Evans',
    'Thomas','Johnson','Roberts','Walker','Robinson','Wright','Thompson','White',
    'Hughes','Edwards','Green','Lewis','Wood','Harris','Martin','Jackson',
    'Clarke','Turner','Hill','Scott','Cooper','Morris','Ward','Moore',
    'King','Watson','Baker','Barker','Fisher','Hamilton','Gordon','Simpson',
    'Murray','Stewart','Campbell','Kelly','Fox','Gray','Rose','Young',
    'Palmer','Barnes','Mason','Hunt','Price','Reid','Bell','Grant',
    'Oliver','Shaw','Burke','Dixon','Cole','Perry','Jenkins','Watts',
    'Spencer','Tucker','Chambers','Fleming','Curtis','Boyd','Hart','Cross'
  ];

  const POSITIONS = ['GK','DEF','DEF','DEF','DEF','MID','MID','MID','MID','FWD','FWD',
                     'DEF','MID','MID','FWD','GK'];

  const SKILLS = ['Pace','Shooting','Passing','Tackling','Heading','Stamina'];
  const GK_SKILLS = ['Pace','Handling','Passing','Tackling','Heading','Stamina'];
  // All unique skill names (for UI column headers)
  const ALL_SKILLS = ['Pace','Shooting','Handling','Passing','Tackling','Heading','Stamina'];

  // Position-specific skill sets and training focus
  const POSITION_SKILLS_MAP = {
    GK:  { skills: GK_SKILLS,  focus: ['Handling', 'Tackling'] },
    DEF: { skills: SKILLS,     focus: ['Tackling', 'Heading'] },
    MID: { skills: SKILLS,     focus: ['Passing', 'Stamina'] },
    FWD: { skills: SKILLS,     focus: ['Shooting', 'Pace'] }
  };

  function getSkillsForPosition(pos) {
    return POSITION_SKILLS_MAP[pos]?.skills || SKILLS;
  }

  // Position-weighted skill importance for OVR calculation
  const POSITION_SKILL_WEIGHTS = {
    GK:  { Pace: 0.6, Handling: 1.5, Passing: 0.8, Tackling: 1.3, Heading: 1.2, Stamina: 0.6 },
    DEF: { Pace: 0.8, Shooting: 0.5, Passing: 0.8, Tackling: 1.5, Heading: 1.3, Stamina: 1.0 },
    MID: { Pace: 0.9, Shooting: 0.9, Passing: 1.5, Tackling: 0.8, Heading: 0.7, Stamina: 1.3 },
    FWD: { Pace: 1.3, Shooting: 1.5, Passing: 0.8, Tackling: 0.5, Heading: 1.0, Stamina: 0.9 }
  };

  function calcOverall(position, skills) {
    const weights = POSITION_SKILL_WEIGHTS[position] || {};
    let weightedSum = 0, totalWeight = 0;
    for (const sk of Object.keys(skills)) {
      const w = weights[sk] || 1.0;
      weightedSum += skills[sk] * w;
      totalWeight += w;
    }
    return Math.round(weightedSum / totalWeight);
  }

  const STAFF_ROLES = ['Coach','Scout','Physio'];
  const STAFF_QUALITIES = ['Useless','Poor','Average','Good','Excellent'];
  const STAFF_COSTS = [500, 1500, 3000, 6000, 12000]; // weekly wage

  // Assistant Coach quality tiers (same scale as other staff but separate for clarity)
  const ASST_COACH_QUALITY = {
    levels: ['None','Amateur','Semi-Pro','Professional','Elite'],
    costs: [0, 600, 1800, 4000, 9000],       // weekly wage
    trainBonus: [0, 0.03, 0.07, 0.12, 0.18]  // added to training chance when active
  };

  const ACADEMY_QUALITY = {
    levels: ['Basic','Improved','Advanced','Elite','World Class'],
    costs: [0, 40000, 120000, 300000, 600000],
    baseSkillBonus: [0, 4, 8, 13, 18],       // added to youth player base skill range
    prospectCount: [3, 3, 4, 4, 5],           // how many new prospects arrive each cycle
    maxCapacity: [5, 6, 8, 10, 12]            // max prospects in academy pool at once
  };

  const YOUTH_COACH_QUALITY = {
    levels: ['None','Amateur','Semi-Pro','Professional','Elite'],
    costs: [0, 800, 2000, 4500, 10000],       // weekly wage
    trainBonus: [0, 0.05, 0.12, 0.20, 0.30]   // added to youth training chance
  };

  const GROUND_UPGRADES = {
    capacity: { levels: [5000, 10000, 20000, 35000, 50000], costs: [0, 50000, 150000, 400000, 800000] },
    safety: { levels: ['Basic','Standard','Good','Excellent','World Class'], costs: [0, 30000, 80000, 200000, 500000] },
    pitch: { levels: ['Muddy','Acceptable','Good','Excellent','Perfect'], costs: [0, 20000, 60000, 150000, 350000] }
  };

  const RANDOM_EVENTS = [
    { type: 'violence', text: 'Crowd violence at {team}! The FA has fined your club £{amount}.', minFine: 5000, maxFine: 25000 },
    { type: 'tv', text: 'Your next match has been selected for live television! Bonus income: £{amount}.', minBonus: 10000, maxBonus: 40000 },
    { type: 'injury', text: '{player} has been injured in training and will miss {weeks} weeks.', minWeeks: 1, maxWeeks: 6 },
    { type: 'grant', text: 'Your club has received a local council grant of £{amount}!', minGrant: 15000, maxGrant: 50000 },
    { type: 'retirement', text: '{player} has announced their retirement from football.', prob: 0.02 },
    { type: 'morale', text: 'Team morale is {mood} after recent results!', moods: ['sky high','very good','good','poor','terrible'] },
    { type: 'scout_find', text: 'Your scout has found a promising player: {player}!', needsScout: true },
    { type: 'sponsor', text: 'A new sponsor offers £{amount} for the season!', minBonus: 20000, maxBonus: 80000 }
  ];

  // Seeded pseudo-random
  let _seed = 42;
  function seededRandom() {
    _seed = (_seed * 16807 + 0) % 2147483647;
    return (_seed - 1) / 2147483646;
  }

  function setSeed(s) { _seed = s; }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generatePlayer(divisionTier, positionOverride) {
    const pos = positionOverride || pick(POSITIONS);
    const age = randInt(17, 35);
    const baseSkill = Math.max(10, 70 - (divisionTier * 12) + randInt(-15, 15));
    const playerSkills = getSkillsForPosition(pos);
    const skills = {};
    for (const sk of playerSkills) {
      let val = baseSkill + randInt(-10, 10);
      // Position-based bonuses
      if (pos === 'GK' && (sk === 'Handling' || sk === 'Tackling')) val += 10;
      if (pos === 'DEF' && (sk === 'Tackling' || sk === 'Heading')) val += 8;
      if (pos === 'MID' && (sk === 'Passing' || sk === 'Stamina')) val += 8;
      if (pos === 'FWD' && (sk === 'Shooting' || sk === 'Pace')) val += 10;
      skills[sk] = Math.max(1, Math.min(99, val));
    }
    const overall = calcOverall(pos, skills);
    const wage = Math.round((overall * 50 + randInt(0, 500)) / 10) * 10;
    // Age multiplier: young players (17-22) worth more, older (31+) worth less
    const ageMult = age <= 22 ? 1.3 - (age - 17) * 0.04 : age <= 29 ? 1.0 : 1.0 - (age - 29) * 0.07;
    // Division multiplier: higher divisions increase value
    const divMult = [1.5, 1.2, 1.0, 0.8][divisionTier] || 1.0;
    const value = Math.round(overall * 10000 * ageMult * divMult);

    return {
      id: Math.random().toString(36).substr(2, 9),
      name: pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES),
      position: pos,
      age,
      skills,
      overall,
      wage,
      value,
      injured: 0, // weeks remaining
      morale: randInt(50, 80),
      training: null // skill being trained
    };
  }

  function generateTeam(name, divisionIndex) {
    const players = [];
    // Generate a balanced squad of 16
    const posCount = { GK: 2, DEF: 5, MID: 5, FWD: 4 };
    for (const [pos, count] of Object.entries(posCount)) {
      for (let i = 0; i < count; i++) {
        players.push(generatePlayer(divisionIndex, pos));
      }
    }
    return {
      name,
      players,
      balance: 100000 + randInt(0, 50000) - (divisionIndex * 15000),
      weeklyWages: players.reduce((s, p) => s + p.wage, 0),
      staff: {
        Coach: { quality: 2, wage: STAFF_COSTS[2] },
        Scout: { quality: 1, wage: STAFF_COSTS[1] },
        Physio: { quality: 1, wage: STAFF_COSTS[1] }
      },
      ground: {
        capacity: divisionIndex === 0 ? 2 : divisionIndex === 1 ? 1 : 0,
        safety: divisionIndex === 0 ? 1 : 0,
        pitch: divisionIndex === 0 ? 1 : 0
      },
      isHuman: false,
      humanPlayerIndex: -1,
      points: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      played: 0,
      form: [] // last 5 results: W/D/L
    };
  }

  function generateFixtures(teamNames) {
    // Round-robin: each team plays every other team twice (home and away) = 30 games
    const n = teamNames.length; // 16
    const fixtures = [];
    const teams = [...Array(n).keys()];
    // Using a simple round-robin algorithm
    for (let round = 0; round < (n - 1); round++) {
      const roundFixtures = [];
      for (let match = 0; match < n / 2; match++) {
        const home = teams[match];
        const away = teams[n - 1 - match];
        roundFixtures.push([home, away]);
      }
      fixtures.push(roundFixtures);
      // Rotate: keep first fixed, rotate rest
      teams.splice(1, 0, teams.pop());
    }
    // Second half: reverse home/away
    const secondHalf = fixtures.map(round =>
      round.map(([h, a]) => [a, h])
    );
    // Reorder rounds so no team plays more than 2 consecutive
    // home or away games, ensuring steady gate income.
    const allRounds = [...fixtures, ...secondHalf];
    const MAX_CONSEC = 2;

    function tryOrder() {
      // Greedy pick: choose round with fewest constraint violations
      const ordered = [];
      const cH = new Array(n).fill(0);
      const cA = new Array(n).fill(0);
      const used = new Array(allRounds.length).fill(false);
      for (let pick = 0; pick < allRounds.length; pick++) {
        let bestScore = Infinity;
        const cands = [];
        for (let r = 0; r < allRounds.length; r++) {
          if (used[r]) continue;
          let v = 0;
          for (const [h, a] of allRounds[r]) {
            if (cH[h] >= MAX_CONSEC) v++;
            if (cA[a] >= MAX_CONSEC) v++;
          }
          if (v < bestScore) { bestScore = v; cands.length = 0; cands.push(r); }
          else if (v === bestScore) cands.push(r);
        }
        const idx = cands[Math.floor(Math.random() * cands.length)];
        used[idx] = true;
        ordered.push(allRounds[idx]);
        for (const [h, a] of allRounds[idx]) {
          cH[h]++; cA[a]++; cH[a] = 0; cA[h] = 0;
        }
      }
      // Check max consecutive for any team
      let worst = 0;
      for (let t = 0; t < n; t++) {
        let ch = 0, ca = 0;
        for (const round of ordered) {
          let isHome = false;
          for (const [h, a] of round) {
            if (h === t) isHome = true;
            if (a === t) isHome = false;
          }
          if (isHome) { ch++; ca = 0; } else { ca++; ch = 0; }
          if (ch > worst) worst = ch;
          if (ca > worst) worst = ca;
        }
      }
      return { ordered, worst };
    }

    // Retry until we get max 2 consecutive (typically 1-3 attempts)
    for (let attempt = 0; attempt < 50; attempt++) {
      const { ordered, worst } = tryOrder();
      if (worst <= MAX_CONSEC) return ordered;
    }
    // Fallback: return best-effort from last attempt
    return tryOrder().ordered;
  }

  // ===== AI MANAGER PERSONALITIES =====
  const AI_MANAGER_TYPES = [
    {
      key: 'pragmatist',
      label: 'The Pragmatist',
      icon: '🎯',
      desc: 'Results first. Buys proven players, trains weaknesses, conservative tactics.',
      // Decision weights
      spendPct: 0.40,          // max % of balance willing to spend per transfer window
      preferredFormation: '4-4-2',
      formationFlexibility: 0.15,  // chance to change formation per cycle
      buyAgeRange: [22, 30],   // preferred player age range
      sellThreshold: 0.85,     // sell players below this % of team avg overall
      staffPriority: ['Coach', 'Scout', 'Physio'],
      groundPriority: ['pitch', 'capacity', 'safety'],
      trainingStyle: 'weakest', // train each player's weakest skill
      youthMinPotential: 80,   // only sign youth with potential >= this
      riskTolerance: 0.2,
      panicBuyThreshold: 3     // consecutive losses before panic buying
    },
    {
      key: 'tactician',
      label: 'The Tactician',
      icon: '🧠',
      desc: 'Formation-obsessed. Rotates tactics, invests heavily in coaching staff.',
      spendPct: 0.25,
      preferredFormation: '3-5-2',
      formationFlexibility: 0.50,
      buyAgeRange: [20, 29],
      sellThreshold: 0.80,
      staffPriority: ['Coach', 'Coach', 'Scout'],  // double-weight coach
      groundPriority: ['pitch', 'safety', 'capacity'],
      trainingStyle: 'positional', // train position-critical skills
      youthMinPotential: 70,
      riskTolerance: 0.35,
      panicBuyThreshold: 4
    },
    {
      key: 'moneybag',
      label: 'The Moneybag',
      icon: '💰',
      desc: 'Buys the best players aggressively. Willing to take risks with finances.',
      spendPct: 0.90,
      preferredFormation: '4-3-3',
      formationFlexibility: 0.10,
      buyAgeRange: [23, 31],
      sellThreshold: 0.90,     // high standards — sells anyone not top quality
      staffPriority: ['Coach', 'Physio', 'Scout'],
      groundPriority: ['capacity', 'pitch', 'safety'],
      trainingStyle: 'minimal', // relies on buying talent
      youthMinPotential: 99,   // effectively ignores youth
      riskTolerance: 0.8,
      panicBuyThreshold: 2
    },
    {
      key: 'developer',
      label: 'The Developer',
      icon: '🌱',
      desc: 'Youth-first. Invests in academy, rarely buys, sells veterans to fund growth.',
      spendPct: 0.15,
      preferredFormation: '4-4-2',
      formationFlexibility: 0.20,
      buyAgeRange: [17, 24],   // only buys young players
      sellThreshold: 0.75,
      staffPriority: ['Scout', 'Coach', 'Physio'],
      groundPriority: ['pitch', 'safety', 'capacity'],
      trainingStyle: 'development', // focus on young players, positional skills
      youthMinPotential: 65,   // signs most youth prospects
      riskTolerance: 0.25,
      panicBuyThreshold: 5     // very patient
    },
    {
      key: 'gambler',
      label: 'The Gambler',
      icon: '🎲',
      desc: 'Unpredictable. Bold transfers, wild formations, high variance results.',
      spendPct: 0.60,          // base, but actual is randomized 10-80%
      preferredFormation: '3-4-3',
      formationFlexibility: 0.70,
      buyAgeRange: [17, 35],   // buys anyone
      sellThreshold: 0.70,
      staffPriority: ['Coach', 'Scout', 'Physio'],  // random in practice
      groundPriority: ['capacity', 'pitch', 'safety'],
      trainingStyle: 'random',
      youthMinPotential: 60,
      riskTolerance: 0.9,
      panicBuyThreshold: 2
    }
  ];

  // Names for AI managers (used in news/display)
  const AI_MANAGER_NAMES = [
    'A. Ferguson','J. Mourinho','P. Guardiola','C. Ancelotti','A. Wenger',
    'B. Clough','J. Stein','B. Shankly','D. Revie','R. Paisley',
    'K. Dalglish','T. Venables','H. Redknapp','S. Allardyce','G. Hoddle',
    'M. O\'Neill','D. Moyes','R. Hodgson','G. Souness','W. Robson',
    'L. van Gaal','R. Benitez','M. Pochettino','T. Henry','F. Lampard',
    'S. Gerrard','G. Neville','R. Giggs','P. Scholes','D. Beckham',
    'J. Carragher','M. Arteta','V. Kompany','W. Rooney','J. Terry',
    'S. Bruce','M. Hughes','C. Coleman','P. Ince','B. Robson',
    'N. Clough','M. Busby','R. Atkinson','G. Graham','J. Lyall',
    'H. Catterick','D. Mackay','A. Ramsey','J. Harvey','B. Nicholl',
    'T. Docherty','D. Sexton','R. Greenwood','E. Howe','O. Glasner',
    'M. Sarri','D. Simeone','E. ten Hag','X. Alonso','T. Tuchel',
    'R. De Zerbi','U. Emery','L. Enrique','M. Allegri','S. Pioli'
  ];

  // Generate transfer market pool (extra players not on any team)
  function generateTransferPool(count) {
    const pool = [];
    for (let i = 0; i < count; i++) {
      const div = randInt(0, 3);
      const p = generatePlayer(div);
      p.askingPrice = Math.round(p.value * (1 + Math.random() * 0.5));
      pool.push(p);
    }
    return pool;
  }

  return {
    TEAM_NAMES,
    FIRST_NAMES,
    LAST_NAMES,
    POSITIONS,
    SKILLS,
    GK_SKILLS,
    ALL_SKILLS,
    POSITION_SKILLS_MAP,
    getSkillsForPosition,
    POSITION_SKILL_WEIGHTS,
    calcOverall,
    STAFF_ROLES,
    STAFF_QUALITIES,
    STAFF_COSTS,
    ASST_COACH_QUALITY,
    ACADEMY_QUALITY,
    YOUTH_COACH_QUALITY,
    GROUND_UPGRADES,
    RANDOM_EVENTS,
    AI_MANAGER_TYPES,
    AI_MANAGER_NAMES,
    generatePlayer,
    generateTeam,
    generateFixtures,
    generateTransferPool,
    randInt,
    pick,
    setSeed
  };

})();

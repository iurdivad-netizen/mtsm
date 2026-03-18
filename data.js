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

  const STAFF_ROLES = ['Coach','Scout','Physio'];
  const STAFF_QUALITIES = ['Useless','Poor','Average','Good','Excellent'];
  const STAFF_COSTS = [500, 1500, 3000, 6000, 12000]; // weekly wage

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
    const skills = {};
    for (const sk of SKILLS) {
      let val = baseSkill + randInt(-10, 10);
      // Position-based bonuses
      if (pos === 'GK' && (sk === 'Tackling' || sk === 'Heading')) val += 10;
      if (pos === 'DEF' && sk === 'Tackling') val += 8;
      if (pos === 'MID' && sk === 'Passing') val += 8;
      if (pos === 'FWD' && sk === 'Shooting') val += 10;
      skills[sk] = Math.max(1, Math.min(99, val));
    }
    const overall = Math.round(Object.values(skills).reduce((a, b) => a + b, 0) / SKILLS.length);
    const wage = Math.round((overall * 50 + randInt(0, 500)) / 10) * 10;
    const value = Math.round(wage * 52 * (1 + (99 - overall) / 100 * 0.5));

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
    return [...fixtures, ...secondHalf];
  }

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
    STAFF_ROLES,
    STAFF_QUALITIES,
    STAFF_COSTS,
    GROUND_UPGRADES,
    RANDOM_EVENTS,
    generatePlayer,
    generateTeam,
    generateFixtures,
    generateTransferPool,
    randInt,
    pick,
    setSeed
  };

})();

/* ========= MTSM UI Layer ========= */
'use strict';

const MTSM_UI = (() => {

  const app = () => document.getElementById('app');
  let currentView = 'title';
  let notification = '';

  function showNotification(msg, isError = false) {
    notification = msg;
    const el = document.getElementById('notification');
    if (el) {
      el.textContent = msg;
      el.className = 'notification ' + (isError ? 'error' : 'success');
      el.classList.remove('hidden');
      setTimeout(() => el.classList.add('hidden'), 3000);
    }
  }

  // ===== TITLE SCREEN =====
  function renderTitle() {
    currentView = 'title';
    app().innerHTML = `
      <div class="title-screen">
        <div class="field-art">
    ╔══════════════════════════════╗
    ║  ┌─────┐     ┌─────┐       ║
    ║  │     │     │     │       ║
    ║  └──┬──┘     └──┬──┘       ║
    ║─────┴───────────┴──────────║
    ║         ┌───┐              ║
    ║         │ ○ │              ║
    ║         └───┘              ║
    ║─────────────────────────────║
    ╚══════════════════════════════╝
        </div>
        <div class="title-logo">
          MULTI-PLAYER<br>SOCCER<br>MANAGER
          <span class="subtitle">— Season ${new Date().getFullYear()} Edition —</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;align-items:center;">
          <button class="btn btn-accent" onclick="MTSM_UI.renderSetup()">NEW GAME</button>
          <button class="btn" onclick="MTSM_UI._triggerLoad()">LOAD GAME</button>
          <div class="text-muted" style="font-size:14px;">Up to 4 players • 64 teams • 4 divisions</div>
        </div>
        <input type="file" id="load-file-input" accept=".json" style="display:none;" onchange="MTSM_UI._handleLoadFile(event)">
      </div>
    `;
  }

  // ===== GAME OPTIONS DEFINITIONS =====
  const GAME_OPTIONS_META = [
    {
      key: 'boardConfidence',
      label: 'Board Confidence',
      icon: '📊',
      desc: 'The board tracks your results with a visible confidence meter. Drop too low and you\'re sacked.',
      note: 'Original: the board sacked you silently after bankruptcy. This adds visible pressure every week.'
    },
    {
      key: 'formationStrategy',
      label: 'Formation Strategy',
      icon: '📋',
      desc: 'Choose a tactical formation before each match (4-4-2, 3-5-2, etc.) for positional bonuses.',
      note: 'Original: no formation selector. This makes pre-match decisions more engaging.'
    },
    {
      key: 'youthAcademy',
      label: 'Youth Academy',
      icon: '🌱',
      desc: 'Scout cheap young players (age 16-18) with high potential. They start weak but grow fast.',
      note: 'Original: no youth system. This adds long-term squad building depth.'
    },
    {
      key: 'negotiation',
      label: 'Negotiation',
      icon: '🤝',
      desc: 'Major transfers require a bid/counter-bid round instead of instant buys.',
      note: 'Original: instant purchases. This adds a haggling mini-game for expensive signings.'
    },
    {
      key: 'cupPrizeMoney',
      label: 'Cup Competition',
      icon: '🏆',
      desc: 'A knockout cup runs alongside the league with prize money at each round.',
      note: 'Original: league only. Cup runs become financially critical, especially in lower divisions.'
    }
  ];

  let _gameOptions = {
    boardConfidence: false,
    formationStrategy: false,
    youthAcademy: false,
    negotiation: false,
    cupPrizeMoney: false
  };

  // ===== SETUP SCREEN =====
  function renderSetup() {
    currentView = 'setup';
    const div4Teams = MTSM_DATA.TEAM_NAMES.slice(48, 64);
    app().innerHTML = `
      <div class="setup-screen">
        <h2>⚽ GAME SETUP</h2>
        <div class="panel">
          <div class="panel-header">NUMBER OF PLAYERS</div>
          <div class="btn-group" style="justify-content:center;">
            ${[1,2,3,4].map(n => `
              <button class="btn btn-small ${n === 1 ? 'active' : ''}" onclick="MTSM_UI._setPlayerCount(${n})" id="pc-${n}">${n} Player${n>1?'s':''}</button>
            `).join('')}
          </div>
        </div>
        <div id="player-forms"></div>

        <div class="panel">
          <div class="panel-header">🎮 GAME OPTIONS</div>
          <div class="text-muted" style="font-size:13px;margin-bottom:12px;">Toggle new features on or off. Disabled = original 1991 experience.</div>
          <div class="options-grid">
            ${GAME_OPTIONS_META.map(opt => `
              <div class="option-card" id="opt-card-${opt.key}" onclick="MTSM_UI._toggleOption('${opt.key}')">
                <div class="option-header">
                  <span class="option-icon">${opt.icon}</span>
                  <span class="option-label">${opt.label}</span>
                  <span class="option-toggle" id="opt-${opt.key}">${_gameOptions[opt.key] ? '▣ ON' : '▢ OFF'}</span>
                </div>
                <div class="option-desc">${opt.desc}</div>
                <div class="option-note">⬆ vs original: ${opt.note}</div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:12px;text-align:center;">
            <button class="btn btn-small" onclick="MTSM_UI._toggleAllOptions(true)" style="margin-right:8px;">ALL ON</button>
            <button class="btn btn-small" onclick="MTSM_UI._toggleAllOptions(false)">ALL OFF</button>
          </div>
        </div>

        <div class="text-center mt-4">
          <button class="btn btn-accent" onclick="MTSM_UI._startGame()">START SEASON</button>
        </div>
      </div>
    `;
    _setPlayerCount(1);
  }

  let _numPlayers = 1;
  let _selectedTeams = new Set();

  function _setPlayerCount(n) {
    _numPlayers = n;
    _selectedTeams.clear();
    document.querySelectorAll('.btn-group .btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`pc-${n}`);
    if (btn) btn.classList.add('active');

    const div4Teams = MTSM_DATA.TEAM_NAMES.slice(48, 64);
    const forms = document.getElementById('player-forms');
    forms.innerHTML = '';
    for (let i = 0; i < n; i++) {
      forms.innerHTML += `
        <div class="player-setup">
          <label>PLAYER ${i + 1} NAME</label>
          <input type="text" id="pname-${i}" value="Manager ${i + 1}" maxlength="20">
          <label>SELECT TEAM (Division 4)</label>
          <select id="pteam-${i}" onchange="MTSM_UI._validateTeamSelection()">
            <option value="random">🎲 Random</option>
            ${div4Teams.map((t, idx) => `<option value="${idx}">${t}</option>`).join('')}
          </select>
        </div>
      `;
    }
  }

  function _toggleOption(key) {
    _gameOptions[key] = !_gameOptions[key];
    const el = document.getElementById(`opt-${key}`);
    const card = document.getElementById(`opt-card-${key}`);
    if (el) el.textContent = _gameOptions[key] ? '▣ ON' : '▢ OFF';
    if (card) {
      card.classList.toggle('option-on', _gameOptions[key]);
    }
  }

  function _toggleAllOptions(onOff) {
    for (const opt of GAME_OPTIONS_META) {
      _gameOptions[opt.key] = onOff;
      const el = document.getElementById(`opt-${opt.key}`);
      const card = document.getElementById(`opt-card-${opt.key}`);
      if (el) el.textContent = onOff ? '▣ ON' : '▢ OFF';
      if (card) card.classList.toggle('option-on', onOff);
    }
  }

  function _validateTeamSelection() {
    _selectedTeams.clear();
    for (let i = 0; i < _numPlayers; i++) {
      const sel = document.getElementById(`pteam-${i}`);
      _selectedTeams.add(parseInt(sel.value));
    }
  }

  function _startGame() {
    const humanPlayers = [];
    const usedTeams = new Set();
    const allIndices = [...Array(16).keys()]; // 0-15 for Division 4

    for (let i = 0; i < _numPlayers; i++) {
      const name = document.getElementById(`pname-${i}`).value.trim() || `Manager ${i + 1}`;
      const rawVal = document.getElementById(`pteam-${i}`).value;
      let teamIdx;

      if (rawVal === 'random') {
        // Pick a random team not already taken
        const available = allIndices.filter(idx => !usedTeams.has(idx));
        if (available.length === 0) {
          showNotification('No teams left to assign randomly!', true);
          return;
        }
        teamIdx = available[Math.floor(Math.random() * available.length)];
      } else {
        teamIdx = parseInt(rawVal);
      }

      if (usedTeams.has(teamIdx)) {
        showNotification('Each player must have a different team! Adjust your selections.', true);
        return;
      }
      usedTeams.add(teamIdx);
      humanPlayers.push({ name, teamIndex: teamIdx });
    }
    MTSM_ENGINE.initGame(humanPlayers, { ..._gameOptions });
    renderGame();
  }

  // ===== MAIN GAME SCREEN =====
  function renderGame(subView = 'menu') {
    currentView = 'game';
    const state = MTSM_ENGINE.getState();
    const team = MTSM_ENGINE.getCurrentHumanTeam();

    if (!team) {
      renderGameOver();
      return;
    }

    const hp = state.humanPlayers[state.currentPlayerIndex];

    app().innerHTML = `
      <div class="game-screen">
        <div class="game-header">
          <div>
            <div class="team-name">${team.name}</div>
            <div style="font-size:12px;color:var(--color-text-muted);">Manager: ${hp.name} • Division ${hp.division + 1}</div>
          </div>
          <div class="info-strip">
            <span>Season <span class="value">${state.season}</span></span>
            <span>Week <span class="value">${state.week}</span></span>
            <span>Balance <span class="value ${team.balance < 0 ? 'text-danger' : ''}">${formatMoney(team.balance)}</span></span>
            ${state.options.boardConfidence ? `
              <span class="confidence-badge" title="Board Confidence">
                <span class="confidence-label">Board</span>
                <span class="confidence-bar"><span class="confidence-fill" style="width:${hp.boardConfidence}%;background:${hp.boardConfidence > 60 ? 'var(--color-success)' : hp.boardConfidence > 30 ? 'var(--color-accent)' : 'var(--color-danger)'};"></span></span>
                <span class="confidence-val ${hp.boardConfidence <= 30 ? 'text-danger' : hp.boardConfidence > 60 ? 'text-success' : 'text-accent'}">${hp.boardConfidence}%</span>
              </span>
            ` : ''}
            <button class="btn btn-small" onclick="MTSM_UI._saveGame()" title="Save game to file">💾 SAVE</button>
            <button class="btn btn-small" onclick="MTSM_UI._triggerLoad()" title="Load game from file">📂 LOAD</button>
          </div>
        </div>
        <input type="file" id="load-file-input" accept=".json" style="display:none;" onchange="MTSM_UI._handleLoadFile(event)">

        ${state.humanPlayers.filter(h => !h.sacked).length > 1 ? `
          <div class="tab-bar">
            ${state.humanPlayers.filter(h => !h.sacked).map((h, i) => `
              <button class="tab-btn ${i === state.currentPlayerIndex ? 'active' : ''}"
                onclick="MTSM_ENGINE.getState().currentPlayerIndex=${i};MTSM_UI.renderGame();">
                ${h.name}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <div id="notification" class="notification hidden"></div>

        ${renderDashboardStats()}

        <div class="icon-menu">
          <button class="icon-btn ${subView === 'squad' ? 'active' : ''}" onclick="MTSM_UI.renderGame('squad')">
            <span class="icon">👥</span>Squad
          </button>
          <button class="icon-btn ${subView === 'training' ? 'active' : ''}" onclick="MTSM_UI.renderGame('training')">
            <span class="icon">🏋️</span>Train
          </button>
          <button class="icon-btn ${subView === 'tactics' ? 'active' : ''}" onclick="MTSM_UI.renderGame('tactics')">
            <span class="icon">📋</span>Tactics
          </button>
          <button class="icon-btn ${subView === 'transfers' ? 'active' : ''}" onclick="MTSM_UI.renderGame('transfers')">
            <span class="icon">💰</span>Transfer
          </button>
          ${state.options.youthAcademy ? `
            <button class="icon-btn ${subView === 'academy' ? 'active' : ''}" onclick="MTSM_UI.renderGame('academy')">
              <span class="icon">🌱</span>Academy
            </button>
          ` : ''}
          <button class="icon-btn ${subView === 'league' ? 'active' : ''}" onclick="MTSM_UI.renderGame('league')">
            <span class="icon">🏆</span>League
          </button>
          ${state.options.cupPrizeMoney ? `
            <button class="icon-btn ${subView === 'cup' ? 'active' : ''}" onclick="MTSM_UI.renderGame('cup')">
              <span class="icon">🥇</span>Cup
            </button>
            <button class="icon-btn ${subView === 'nationalCup' ? 'active' : ''}" onclick="MTSM_UI.renderGame('nationalCup')">
              <span class="icon">🏅</span>Nat. Cup
            </button>
            <button class="icon-btn ${subView === 'leagueTrophy' ? 'active' : ''}" onclick="MTSM_UI.renderGame('leagueTrophy')">
              <span class="icon">🏆</span>Trophy
            </button>
          ` : ''}
          <button class="icon-btn ${subView === 'fixtures' ? 'active' : ''}" onclick="MTSM_UI.renderGame('fixtures')">
            <span class="icon">📅</span>Fixtures
          </button>
          <button class="icon-btn ${subView === 'finances' ? 'active' : ''}" onclick="MTSM_UI.renderGame('finances')">
            <span class="icon">🏦</span>Bank
          </button>
          <button class="icon-btn ${subView === 'staff' ? 'active' : ''}" onclick="MTSM_UI.renderGame('staff')">
            <span class="icon">👔</span>Staff
          </button>
          <button class="icon-btn ${subView === 'ground' ? 'active' : ''}" onclick="MTSM_UI.renderGame('ground')">
            <span class="icon">🏟️</span>Ground
          </button>
          <button class="icon-btn ${subView === 'results' ? 'active' : ''}" onclick="MTSM_UI.renderGame('results')">
            <span class="icon">📊</span>Results
          </button>
          <button class="icon-btn ${subView === 'news' ? 'active' : ''}" onclick="MTSM_UI.renderGame('news')">
            <span class="icon">📰</span>News
          </button>
          <button class="icon-btn" onclick="MTSM_UI._playMatchDay()" style="border-color:var(--color-accent);color:var(--color-accent);">
            <span class="icon">⚽</span>Play
          </button>
        </div>

        <div id="game-content" class="panel mt-4">
          ${renderSubView(subView)}
        </div>
      </div>
    `;
  }

  function renderSubView(view) {
    switch (view) {
      case 'squad': return renderSquad();
      case 'training': return renderTraining();
      case 'tactics': return renderTactics();
      case 'transfers': return renderTransfers();
      case 'academy': return renderAcademy();
      case 'league': return renderLeague();
      case 'cup': return renderCup();
      case 'nationalCup': return renderNationalCup('nationalCup', 'National Cup', MTSM_ENGINE.NATIONAL_CUP_PRIZE_MONEY);
      case 'leagueTrophy': return renderNationalCup('leagueTrophy', 'League Trophy', MTSM_ENGINE.LEAGUE_TROPHY_PRIZE_MONEY);
      case 'fixtures': return renderFixtures();
      case 'finances': return renderFinances();
      case 'staff': return renderStaff();
      case 'ground': return renderGround();
      case 'results': return renderResults();
      case 'news': return renderNewsBoard();
      default: return renderMenu();
    }
  }

  // ===== DASHBOARD STATS (above buttons) =====
  function renderDashboardStats() {
    const state = MTSM_ENGINE.getState();
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const hp = state.humanPlayers[state.currentPlayerIndex];
    const table = MTSM_ENGINE.getLeagueTable(hp.division);
    const pos = table.findIndex(t => t.name === team.name) + 1;

    return `
      <div class="panel mt-4">
        <div class="panel-header">📋 DASHBOARD</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
          <div>
            <div class="text-muted" style="font-size:12px;">LEAGUE POSITION</div>
            <div class="text-accent" style="font-size:28px;font-family:var(--font-display);">${pos}${ordinal(pos)}</div>
            <div class="text-muted">Division ${hp.division + 1}</div>
          </div>
          <div>
            <div class="text-muted" style="font-size:12px;">RECORD</div>
            <div style="font-size:22px;">
              <span class="text-success">${team.won}W</span>
              <span class="text-accent">${team.drawn}D</span>
              <span class="text-danger">${team.lost}L</span>
            </div>
            <div class="text-muted">${team.points} points • GD ${team.goalsFor - team.goalsAgainst > 0 ? '+' : ''}${team.goalsFor - team.goalsAgainst}</div>
          </div>
          <div>
            <div class="text-muted" style="font-size:12px;">FORM</div>
            <div style="font-size:22px;display:flex;gap:4px;">
              ${team.form.length === 0 ? '<span class="text-muted">—</span>' :
                team.form.map(f => `<span class="${f === 'W' ? 'text-success' : f === 'D' ? 'text-accent' : 'text-danger'}">${f}</span>`).join('')}
            </div>
          </div>
          <div>
            <div class="text-muted" style="font-size:12px;">SQUAD</div>
            <div style="font-size:22px;">${team.players.length} <span class="text-muted" style="font-size:14px;">players</span></div>
            <div class="text-muted">${team.players.filter(p => p.injured > 0).length} injured</div>
          </div>
        </div>
      </div>
    `;
  }

  // ===== MENU (default - news below buttons) =====
  function renderMenu() {
    const state = MTSM_ENGINE.getState();

    if (state.news.length === 0) return '';

    return `
      <div class="news-ticker mt-4">
        <div class="panel-header">📰 NEWS</div>
        ${state.news.map(n => `
          <div class="news-item">
            <span class="event-type">[${n.type}]</span> ${n.text}
          </div>
        `).join('')}
      </div>
    `;
  }

  // ===== SQUAD =====
  function renderSquad() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const positions = ['GK', 'DEF', 'MID', 'FWD'];
    const sorted = [...team.players].sort((a, b) => {
      return positions.indexOf(a.position) - positions.indexOf(b.position) || b.overall - a.overall;
    });

    return `
      <div class="panel-header">👥 SQUAD — ${team.players.length}/16 Players</div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Pos</th><th>Name</th><th>Age</th>
              ${MTSM_DATA.SKILLS.map(s => `<th>${s.substring(0, 3)}</th>`).join('')}
              <th>Ovr</th><th>Wage</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(p => `
              <tr class="${p.injured > 0 ? 'relegation' : ''}">
                <td class="pos-${p.position.toLowerCase()}">${p.position}</td>
                <td>${p.name}</td>
                <td class="num">${p.age}</td>
                ${MTSM_DATA.SKILLS.map(s => `<td class="num">${p.skills[s]}</td>`).join('')}
                <td class="num text-accent">${p.overall}</td>
                <td class="num">£${p.wage}</td>
                <td>${p.injured > 0 ? `<span class="text-danger">INJ ${p.injured}w</span>` :
                      p.training ? `<span class="text-info">Training ${p.training}</span>` : '✓'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="mt-4 text-muted" style="font-size:13px;">
        Weekly wages: £${team.players.reduce((s, p) => s + p.wage, 0).toLocaleString()}
        • Avg overall: ${Math.round(team.players.reduce((s, p) => s + p.overall, 0) / team.players.length)}
        • Team strength: ${MTSM_ENGINE.calculateTeamStrength(team).toFixed(1)}
      </div>
    `;
  }

  // ===== TRAINING =====
  function renderTraining() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const coachQ = MTSM_DATA.STAFF_QUALITIES[team.staff.Coach.quality];

    return `
      <div class="panel-header">🏋️ TRAINING — Coach: ${coachQ}</div>
      <div class="text-muted mb-4" style="font-size:13px;">
        Select a skill to train for each player. Better coaches improve training results.
      </div>
      <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
        <span style="font-size:12px;font-weight:bold;margin-right:4px;">Quick set:</span>
        ${['GK','DEF','MID','FWD'].map(pos => `
          <select onchange="MTSM_UI._setGroupTraining('${pos}', this.value); this.selectedIndex=0;"
            style="font-size:11px;padding:2px 4px;">
            <option value="">All ${pos}s…</option>
            ${MTSM_DATA.SKILLS.map(s => `<option value="${s}">${s}</option>`).join('')}
            <option value="_none">— Clear —</option>
          </select>
        `).join('')}
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Player</th><th>Pos</th>
              ${MTSM_DATA.SKILLS.map(s => `<th>${s.substring(0, 3)}</th>`).join('')}
              <th>Training</th>
            </tr>
          </thead>
          <tbody>
            ${team.players.map(p => `
              <tr>
                <td>${p.name}${p.injured > 0 ? ' <span class="text-danger">(INJ)</span>' : ''}</td>
                <td class="pos-${p.position.toLowerCase()}">${p.position}</td>
                ${MTSM_DATA.SKILLS.map(s => `<td class="num">${p.skills[s]}</td>`).join('')}
                <td>
                  <select onchange="MTSM_UI._setTraining('${p.id}', this.value)" style="font-size:12px;padding:2px 4px;">
                    <option value="">— None —</option>
                    ${MTSM_DATA.SKILLS.map(s => `<option value="${s}" ${p.training === s ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function _setTraining(playerId, skill) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const player = team.players.find(p => p.id === playerId);
    if (player) {
      player.training = skill || null;
    }
  }

  function _setGroupTraining(position, skill) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const value = skill === '_none' ? null : (skill || null);
    for (const p of team.players) {
      if (p.position === position) p.training = value;
    }
    renderGame('training');
  }

  // ===== NEWS BOARD =====
  let _newsFilter = 'ALL';

  function renderNewsBoard() {
    const state = MTSM_ENGINE.getState();
    const log = state.newsLog || [];
    const types = ['ALL', ...new Set(log.map(n => n.type))];
    const filtered = _newsFilter === 'ALL' ? log : log.filter(n => n.type === _newsFilter);
    const reversed = [...filtered].reverse();

    return `
      <div class="panel-header">📰 NEWS BOARD</div>
      <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
        <span style="font-size:12px;font-weight:bold;margin-right:4px;">Filter:</span>
        ${types.map(t => `
          <button class="btn btn-small${_newsFilter === t ? ' active' : ''}"
            onclick="MTSM_UI._filterNews('${t}')"
            style="font-size:11px;padding:2px 8px;${_newsFilter === t ? 'background:var(--color-accent);color:var(--color-bg);' : ''}">
            ${t}
          </button>
        `).join('')}
      </div>
      ${reversed.length === 0 ? '<div class="text-muted">No news yet. Play some matches!</div>' : `
        <div style="max-height:500px;overflow-y:auto;">
          ${reversed.map(n => `
            <div class="news-item" style="padding:4px 8px;border-bottom:1px solid var(--color-border);font-size:13px;">
              <span class="text-muted" style="font-size:11px;">S${n.season} W${n.week}</span>
              <span class="event-type" style="font-size:11px;margin:0 6px;">[${n.type}]</span>
              ${n.text}
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  function _filterNews(type) {
    _newsFilter = type;
    renderGame('news');
  }

  // ===== TRANSFERS =====
  let _transferFilter = { position: '', minOvr: 0, maxPrice: Infinity };

  function renderTransfers() {
    const state = MTSM_ENGINE.getState();
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const pool = state.transferPool;

    let filtered = pool;
    if (_transferFilter.position) {
      filtered = filtered.filter(p => p.position === _transferFilter.position);
    }
    if (_transferFilter.minOvr > 0) {
      filtered = filtered.filter(p => p.overall >= _transferFilter.minOvr);
    }
    filtered = filtered.slice(0, 30); // Show max 30

    return `
      <div class="panel-header">💰 TRANSFER MARKET — ${pool.length} players available</div>

      <div style="margin-bottom:8px;font-family:var(--font-display);font-size:10px;color:var(--color-accent);">YOUR SQUAD (SELL)</div>
      <div style="overflow-x:auto;margin-bottom:16px;">
        <table class="data-table">
          <thead>
            <tr><th>Pos</th><th>Name</th><th>Ovr</th><th>Value</th><th></th></tr>
          </thead>
          <tbody>
            ${team.players.map(p => `
              <tr>
                <td class="pos-${p.position.toLowerCase()}">${p.position}</td>
                <td>${p.name}</td>
                <td class="num">${p.overall}</td>
                <td class="num">£${p.value.toLocaleString()}</td>
                <td><button class="btn btn-small btn-danger" onclick="MTSM_UI._sellPlayer('${p.id}')">Sell</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-bottom:8px;font-family:var(--font-display);font-size:10px;color:var(--color-accent);">MARKET (BUY)</div>
      <div class="transfer-filters">
        <select onchange="MTSM_UI._transferFilter.position=this.value;MTSM_UI.renderGame('transfers');">
          <option value="">All Positions</option>
          <option value="GK" ${_transferFilter.position === 'GK' ? 'selected' : ''}>GK</option>
          <option value="DEF" ${_transferFilter.position === 'DEF' ? 'selected' : ''}>DEF</option>
          <option value="MID" ${_transferFilter.position === 'MID' ? 'selected' : ''}>MID</option>
          <option value="FWD" ${_transferFilter.position === 'FWD' ? 'selected' : ''}>FWD</option>
        </select>
        <select onchange="MTSM_UI._transferFilter.minOvr=parseInt(this.value)||0;MTSM_UI.renderGame('transfers');">
          <option value="0">Min Overall: Any</option>
          <option value="30" ${_transferFilter.minOvr === 30 ? 'selected' : ''}>30+</option>
          <option value="40" ${_transferFilter.minOvr === 40 ? 'selected' : ''}>40+</option>
          <option value="50" ${_transferFilter.minOvr === 50 ? 'selected' : ''}>50+</option>
          <option value="60" ${_transferFilter.minOvr === 60 ? 'selected' : ''}>60+</option>
        </select>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr><th>Pos</th><th>Name</th><th>Age</th><th>Ovr</th><th>Price</th><th>Wage</th><th></th></tr>
          </thead>
          <tbody>
            ${filtered.map(p => `
              <tr${p.scouted ? ' class="scouted-player"' : ''}>
                <td class="pos-${p.position.toLowerCase()}">${p.position}</td>
                <td>${p.name}${p.scouted ? ' <span class="scouted-badge" title="Found by your scout at a discount">SCOUTED</span>' : ''}</td>
                <td class="num">${p.age}</td>
                <td class="num">${p.overall}</td>
                <td class="num">£${(p.askingPrice || p.value).toLocaleString()}</td>
                <td class="num">£${p.wage.toLocaleString()}</td>
                <td><button class="btn btn-small" onclick="MTSM_UI._buyPlayer('${p.id}')">Buy</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function _buyPlayer(playerId, bidAmount) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const result = MTSM_ENGINE.buyPlayer(playerId, team, bidAmount);

    if (result.negotiate) {
      // Show negotiation modal
      _showNegotiationModal(result);
      return;
    }
    if (result.counterOffer) {
      // Show counter-offer modal
      _showCounterOfferModal(result);
      return;
    }
    if (result.success) {
      showNotification(result.msg);
    } else {
      showNotification(result.msg, true);
    }
    renderGame('transfers');
  }

  function _showNegotiationModal(result) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'nego-modal';
    modal.innerHTML = `
      <div class="modal">
        <h3>🤝 TRANSFER NEGOTIATION</h3>
        <div style="margin-bottom:16px;">
          <div class="text-accent" style="font-size:18px;">${result.playerName}</div>
          <div class="text-muted" style="font-size:14px;">Asking price: £${result.askingPrice.toLocaleString()}</div>
          <div class="text-muted" style="font-size:12px;">They might accept as low as ~75% of asking price.</div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);">YOUR BID (£)</label>
          <input type="number" id="nego-bid" value="${Math.round(result.askingPrice * 0.85)}" min="1" style="width:100%;">
        </div>
        <div class="btn-group" style="justify-content:center;">
          <button class="btn btn-accent" onclick="MTSM_UI._submitBid('${result.playerId}')">SUBMIT BID</button>
          <button class="btn" onclick="document.getElementById('nego-modal').remove()">WALK AWAY</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function _submitBid(playerId) {
    const bidInput = document.getElementById('nego-bid');
    const bid = parseInt(bidInput.value) || 0;
    const modal = document.getElementById('nego-modal');
    if (modal) modal.remove();
    _buyPlayer(playerId, bid);
  }

  function _showCounterOfferModal(result) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'nego-modal';
    modal.innerHTML = `
      <div class="modal">
        <h3>🤝 COUNTER OFFER</h3>
        <div style="margin-bottom:16px;">
          <div class="text-accent" style="font-size:18px;">${result.playerName}</div>
          <div style="font-size:16px;">${result.msg}</div>
        </div>
        <div class="btn-group" style="justify-content:center;">
          <button class="btn btn-accent" onclick="document.getElementById('nego-modal').remove();MTSM_UI._buyPlayer('${result.playerId}', ${result.counterPrice})">ACCEPT £${result.counterPrice.toLocaleString()}</button>
          <button class="btn btn-danger" onclick="document.getElementById('nego-modal').remove();MTSM_UI.showNotification('You walked away from the deal.', true);MTSM_UI.renderGame('transfers');">WALK AWAY</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function _sellPlayer(playerId) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const result = MTSM_ENGINE.sellPlayer(playerId, team);
    if (result.success) {
      showNotification(result.msg);
    } else {
      showNotification(result.msg, true);
    }
    renderGame('transfers');
  }

  // ===== LEAGUE TABLE =====
  function renderLeague() {
    const state = MTSM_ENGINE.getState();
    const hp = state.humanPlayers[state.currentPlayerIndex];

    let divSelector = `
      <div class="tab-bar" style="margin-bottom:12px;">
        ${[0,1,2,3].map(d => `
          <button class="tab-btn ${d === state.currentDivision ? 'active' : ''}"
            onclick="MTSM_ENGINE.getState().currentDivision=${d};MTSM_UI.renderGame('league');">
            Div ${d + 1}
          </button>
        `).join('')}
      </div>
    `;

    const table = MTSM_ENGINE.getLeagueTable(state.currentDivision);

    return `
      <div class="panel-header">🏆 LEAGUE TABLE</div>
      ${divSelector}
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th>
              <th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th>
            </tr>
          </thead>
          <tbody>
            ${table.map((t, i) => {
              const isHuman = t.isHuman;
              const isPromo = i < 2 && state.currentDivision > 0;
              const isReleg = i >= 14 && state.currentDivision < 3;
              const isJoker = i === 15 && state.currentDivision === 3;
              let cls = isHuman ? 'highlight' : isPromo ? 'promotion' : (isReleg || isJoker) ? 'relegation' : '';
              return `
                <tr class="${cls}">
                  <td class="num">${i + 1}</td>
                  <td>${t.name}${isHuman ? ' ★' : ''}</td>
                  <td class="num">${t.played}</td>
                  <td class="num">${t.won}</td>
                  <td class="num">${t.drawn}</td>
                  <td class="num">${t.lost}</td>
                  <td class="num">${t.goalsFor}</td>
                  <td class="num">${t.goalsAgainst}</td>
                  <td class="num">${t.goalsFor - t.goalsAgainst > 0 ? '+' : ''}${t.goalsFor - t.goalsAgainst}</td>
                  <td class="num text-accent">${t.points}</td>
                  <td style="font-size:12px;">${t.form.map(f =>
                    `<span class="${f === 'W' ? 'text-success' : f === 'D' ? 'text-accent' : 'text-danger'}">${f}</span>`
                  ).join('')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="mt-2 text-muted" style="font-size:12px;">
        ${state.currentDivision > 0 ? '🟢 Top 2 = Promotion' : ''}
        ${state.currentDivision < 3 ? '&nbsp; 🔴 Bottom 2 = Relegation' : ''}
        ${state.currentDivision === 3 ? '&nbsp; 🏆 Bottom = League Joker Trophy' : ''}
      </div>
    `;
  }

  // ===== FIXTURES =====
  function renderFixtures() {
    const state = MTSM_ENGINE.getState();
    const hp = state.humanPlayers[state.currentPlayerIndex];
    const fixtures = MTSM_ENGINE.getNextFixtures(hp.division);
    const div = state.divisions[hp.division];

    return `
      <div class="panel-header">📅 NEXT FIXTURES — Division ${hp.division + 1} — Round ${div.currentRound + 1}/30</div>
      <div class="match-results">
        ${fixtures.length === 0 ? '<div class="text-muted text-center">Season complete!</div>' :
          fixtures.map(f => `
            <div class="match-result ${f.homeIsHuman || f.awayIsHuman ? 'user-match' : ''}">
              <div class="home">${f.home}${f.homeIsHuman ? ' ★' : ''}</div>
              <div class="score">vs</div>
              <div class="away">${f.away}${f.awayIsHuman ? ' ★' : ''}</div>
            </div>
            ${f.homeIsHuman || f.awayIsHuman ? '<div style="font-size:12px;padding:0 8px 8px;color:var(--color-muted);">' + (f.homeIsHuman ? '🏠 HOME — gate income applies' : '✈️ AWAY') + '</div>' : ''}
          `).join('')
        }
      </div>
    `;
  }

  // ===== TACTICS (Formation + Starting XI) =====
  function renderTactics() {
    const state = MTSM_ENGINE.getState();
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const available = team.players.filter(p => p.injured === 0);
    const injured = team.players.filter(p => p.injured > 0);
    const startingIds = team.startingXI || [];
    const positions = ['GK', 'DEF', 'MID', 'FWD'];
    const sorted = [...available].sort((a, b) => positions.indexOf(a.position) - positions.indexOf(b.position) || b.overall - a.overall);

    // Count selected
    const selectedCount = startingIds.filter(id => available.find(p => p.id === id)).length;

    // Formation section (only if feature is on)
    let formationHtml = '';
    if (state.options.formationStrategy) {
      const currentFormation = team.formation || '4-4-2';
      const formations = MTSM_ENGINE.FORMATIONS;
      const formationDescriptions = {
        '4-4-2': 'Balanced. No bonus — the safe default.',
        '4-3-3': 'Attacking width. +3 with enough forwards.',
        '3-5-2': 'Midfield overload. +4 midfield bonus.',
        '5-3-2': 'Defensive wall. +3 from packed defence.',
        '4-5-1': 'Control. +3 midfield, +1 defensive.',
        '3-4-3': 'All-out attack. +4 forward bonus.'
      };
      formationHtml = `
        <div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:8px;">FORMATION</div>
        <div class="formation-grid mb-4">
          ${Object.keys(formations).map(f => `
            <div class="formation-card ${f === currentFormation ? 'formation-active' : ''}" onclick="MTSM_UI._setFormation('${f}')">
              <div class="formation-name">${f}</div>
              <div class="formation-layout">
                <span class="pos-gk">GK</span>
                <span class="pos-def">${formations[f].DEF} DEF</span>
                <span class="pos-mid">${formations[f].MID} MID</span>
                <span class="pos-fwd">${formations[f].FWD} FWD</span>
              </div>
              <div class="formation-desc">${formationDescriptions[f]}</div>
              ${f === currentFormation ? '<div class="text-accent" style="font-size:10px;font-family:var(--font-display);margin-top:4px;">SELECTED</div>' : ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    // Position counts for current starting XI
    const startingPlayers = startingIds.map(id => available.find(p => p.id === id)).filter(Boolean);
    const posCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    startingPlayers.forEach(p => { posCounts[p.position] = (posCounts[p.position] || 0) + 1; });

    return `
      <div class="panel-header">📋 TACTICS — Starting XI</div>
      <div class="text-muted mb-4" style="font-size:13px;">Select your starting 11 players. Click to toggle. Subs will be on the bench.</div>

      ${formationHtml}

      <div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:8px;">
        STARTING XI
        <span style="float:right;color:${selectedCount === 11 ? 'var(--color-success)' : selectedCount > 11 ? 'var(--color-danger)' : 'var(--color-text-muted)'}">
          ${selectedCount}/11 selected
          ${selectedCount === 11 ? ' ✓' : ''}
          &nbsp;(GK:${posCounts.GK} DEF:${posCounts.DEF} MID:${posCounts.MID} FWD:${posCounts.FWD})
        </span>
      </div>

      <div class="btn-group mb-4">
        <button class="btn btn-small" onclick="MTSM_UI._autoSelectXI()">AUTO-SELECT BEST XI</button>
        <button class="btn btn-small" onclick="MTSM_UI._clearXI()">CLEAR ALL</button>
        <button class="btn btn-small btn-accent" onclick="MTSM_UI._confirmXI()" ${selectedCount !== 11 ? 'disabled style="opacity:0.4"' : ''}>CONFIRM XI</button>
      </div>

      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th></th><th>Pos</th><th>Name</th><th>Age</th>
              ${MTSM_DATA.SKILLS.map(s => `<th>${s.substring(0, 3)}</th>`).join('')}
              <th>Ovr</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(p => {
              const isSelected = startingIds.includes(p.id);
              return `
                <tr class="xi-row ${isSelected ? 'xi-selected' : ''}" onclick="MTSM_UI._toggleXI('${p.id}')" style="cursor:pointer;">
                  <td style="text-align:center;font-size:16px;">${isSelected ? '⚽' : '○'}</td>
                  <td class="pos-${p.position.toLowerCase()}">${p.position}</td>
                  <td>${p.name}</td>
                  <td class="num">${p.age}</td>
                  ${MTSM_DATA.SKILLS.map(s => `<td class="num">${p.skills[s]}</td>`).join('')}
                  <td class="num text-accent">${p.overall}</td>
                  <td>${isSelected ? '<span class="text-success">STARTING</span>' : '<span class="text-muted">Bench</span>'}</td>
                </tr>
              `;
            }).join('')}
            ${injured.map(p => `
              <tr class="relegation" style="opacity:0.5;">
                <td style="text-align:center;">✕</td>
                <td class="pos-${p.position.toLowerCase()}">${p.position}</td>
                <td>${p.name}</td>
                <td class="num">${p.age}</td>
                ${MTSM_DATA.SKILLS.map(s => `<td class="num">${p.skills[s]}</td>`).join('')}
                <td class="num">${p.overall}</td>
                <td><span class="text-danger">INJ ${p.injured}w</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="mt-2 text-muted" style="font-size:12px;">
        Team strength: ${MTSM_ENGINE.calculateTeamStrength(team).toFixed(1)}
        • If no XI is set, the best 11 by overall are auto-selected on match day.
      </div>
    `;
  }

  function _setFormation(f) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const result = MTSM_ENGINE.setFormation(f, team);
    showNotification(result.msg, !result.success);
    renderGame('tactics');
  }

  function _toggleXI(playerId) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    if (!team.startingXI) team.startingXI = [];
    const idx = team.startingXI.indexOf(playerId);
    if (idx >= 0) {
      team.startingXI.splice(idx, 1);
    } else {
      if (team.startingXI.length >= 11) {
        showNotification('Already have 11 selected. Remove one first.', true);
        return;
      }
      team.startingXI.push(playerId);
    }
    renderGame('tactics');
  }

  function _autoSelectXI() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const result = MTSM_ENGINE.autoSelectXI(team);
    showNotification(result.msg, !result.success);
    renderGame('tactics');
  }

  function _clearXI() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    team.startingXI = [];
    renderGame('tactics');
  }

  function _confirmXI() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    if (!team.startingXI || team.startingXI.length !== 11) {
      showNotification('Select exactly 11 players first.', true);
      return;
    }
    const result = MTSM_ENGINE.setStartingXI(team.startingXI, team);
    showNotification(result.msg, !result.success);
    if (result.success) renderGame('tactics');
  }

  // ===== YOUTH ACADEMY =====
  function renderAcademy() {
    const state = MTSM_ENGINE.getState();
    if (!state.options.youthAcademy || !state.youthAcademy) return '<div class="text-muted">Youth academy is disabled.</div>';

    const hpIdx = state.currentPlayerIndex;
    const academy = state.youthAcademy[hpIdx] || [];
    const team = MTSM_ENGINE.getCurrentHumanTeam();

    return `
      <div class="panel-header">🌱 YOUTH ACADEMY — ${academy.length} prospect${academy.length !== 1 ? 's' : ''}</div>
      <div class="text-muted mb-4" style="font-size:13px;">Young players with potential. Low stats now but they develop faster. New prospects arrive every 4 weeks.</div>
      ${academy.length === 0 ? '<div class="text-muted text-center" style="padding:20px;">No prospects available. Check back in a few weeks.</div>' : `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Pos</th><th>Name</th><th>Age</th>
                ${MTSM_DATA.SKILLS.map(s => `<th>${s.substring(0, 3)}</th>`).join('')}
                <th>Ovr</th><th>Pot</th><th>Fee</th><th>Wage</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${academy.map((p, idx) => `
                <tr>
                  <td class="pos-${p.position.toLowerCase()}">${p.position}</td>
                  <td>${p.name}</td>
                  <td class="num">${p.age}</td>
                  ${MTSM_DATA.SKILLS.map(s => `<td class="num">${p.skills[s]}</td>`).join('')}
                  <td class="num text-accent">${p.overall}</td>
                  <td class="num text-success">${p.potential}</td>
                  <td class="num">£${p.value.toLocaleString()}</td>
                  <td class="num">£${p.wage.toLocaleString()}</td>
                  <td><button class="btn btn-small" onclick="MTSM_UI._signYouth(${idx})" ${team.players.length >= 16 ? 'disabled style="opacity:0.3"' : ''}>Sign</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="mt-4 text-muted" style="font-size:12px;">
          ⭐ Potential shows the ceiling. Higher potential = faster growth during training.
          Squad: ${team.players.length}/16
        </div>
      `}
    `;
  }

  function _signYouth(idx) {
    const state = MTSM_ENGINE.getState();
    const result = MTSM_ENGINE.signYouthPlayer(idx, state.currentPlayerIndex);
    showNotification(result.msg, !result.success);
    renderGame('academy');
  }

  // ===== CUP =====
  function renderCup() {
    const state = MTSM_ENGINE.getState();
    if (!state.options.cupPrizeMoney || !state.cup) return '<div class="text-muted">Cup competition is disabled.</div>';

    const hp = state.humanPlayers[state.currentPlayerIndex];
    const divCup = state.cup[hp.division];
    const cupRoundNames = ['Round 1', 'Quarter-Finals', 'Semi-Finals', 'Final'];

    let cupHtml = `
      <div class="panel-header">🥇 DIVISION ${hp.division + 1} CUP</div>
    `;

    if (divCup.finished && divCup.winner) {
      cupHtml += `<div class="text-center" style="padding:16px;"><div style="font-size:40px;">\ud83c\udfc6</div><div class="text-accent" style="font-size:18px;">${divCup.winner}</div><div class="text-muted">Cup Winners!</div></div>`;
    }

    // Show each round's results
    for (let r = 0; r < divCup.rounds.length; r++) {
      const round = divCup.rounds[r];
      const roundName = r < cupRoundNames.length ? cupRoundNames[r] : `Round ${r + 1}`;
      cupHtml += `<div style="margin-bottom:12px;"><div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:6px;">${roundName}</div>`;
      cupHtml += '<div class="match-results">';
      for (const m of round.matches) {
        if (m.played) {
          const result = round.results.find(res => res.home === m.home && res.away === m.away);
          if (result) {
            const team = MTSM_ENGINE.getCurrentHumanTeam();
            const isHuman = result.home === team.name || result.away === team.name;
            cupHtml += `
              <div class="match-result ${isHuman ? 'user-match' : ''}">
                <div class="home ${result.winner === result.home ? 'text-accent' : ''}">${result.home}</div>
                <div class="score">${result.homeGoals} - ${result.awayGoals}</div>
                <div class="away ${result.winner === result.away ? 'text-accent' : ''}">${result.away}</div>
              </div>
            `;
          }
        } else {
          cupHtml += `
            <div class="match-result">
              <div class="home">${m.home}</div>
              <div class="score">vs</div>
              <div class="away">${m.away || 'BYE'}</div>
            </div>
          `;
        }
      }
      cupHtml += '</div></div>';
    }

    // Prize money info
    const prizes = MTSM_ENGINE.CUP_PRIZE_MONEY[hp.division];
    cupHtml += `
      <div class="mt-4 text-muted" style="font-size:12px;">
        Prize money: R1 £${prizes[0].toLocaleString()} • R2 £${prizes[1].toLocaleString()} • QF £${prizes[2].toLocaleString()} • SF £${prizes[3].toLocaleString()} • Final £${prizes[4].toLocaleString()} • Winner £${prizes[5].toLocaleString()}
      </div>
    `;

    return cupHtml;
  }

  // ===== NATIONAL CUP =====
  function renderNationalCup(cupKey, cupName, prizeMoney) {
    const state = MTSM_ENGINE.getState();
    if (!state.options.cupPrizeMoney || !state[cupKey]) return `<div class="text-muted">${cupName} is disabled.</div>`;

    const cup = state[cupKey];
    const roundNames = ['Round 1', 'Round 2', 'Round 3', 'Quarter-Finals', 'Semi-Finals', 'Final'];
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const teamName = team ? team.name : '';

    // Check if human team is still in the cup
    const isEliminated = cup.eliminated.includes(teamName);
    const isWinner = cup.winner === teamName;

    let html = `
      <div class="panel-header">${cupKey === 'nationalCup' ? '🏅' : '🏆'} ${cupName} — 64 Teams (All Divisions)</div>
    `;

    if (cup.finished && cup.winner) {
      html += `<div class="text-center" style="padding:16px;"><div style="font-size:40px;">\ud83c\udfc6</div><div class="text-accent" style="font-size:18px;">${cup.winner}</div><div class="text-muted">${cupName} Winners!</div></div>`;
    }

    // Human team status
    if (teamName) {
      html += `<div style="margin-bottom:12px;padding:8px;border:1px solid var(--color-border);border-radius:4px;font-size:13px;">`;
      if (isWinner) {
        html += `<span class="text-success">Your team won the ${cupName}!</span>`;
      } else if (isEliminated) {
        html += `<span class="text-danger">${teamName} has been eliminated.</span>`;
      } else if (cup.finished) {
        html += `<span class="text-muted">${teamName} was eliminated.</span>`;
      } else {
        html += `<span class="text-success">${teamName} is still in the ${cupName}.</span>`;
      }
      html += `</div>`;
    }

    // Show each round's results
    for (let r = 0; r < cup.rounds.length; r++) {
      const round = cup.rounds[r];
      const roundName = r < roundNames.length ? roundNames[r] : `Round ${r + 1}`;
      html += `<div style="margin-bottom:12px;"><div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:6px;">${roundName} (${round.matches.length} matches)</div>`;
      html += '<div class="match-results">';
      for (const m of round.matches) {
        if (m.played) {
          const result = round.results.find(res => res.home === m.home && res.away === m.away);
          if (result) {
            const isHuman = result.home === teamName || result.away === teamName;
            html += `
              <div class="match-result ${isHuman ? 'user-match' : ''}">
                <div class="home ${result.winner === result.home ? 'text-accent' : ''}">${result.home}</div>
                <div class="score">${result.homeGoals} - ${result.awayGoals}</div>
                <div class="away ${result.winner === result.away ? 'text-accent' : ''}">${result.away}</div>
              </div>
            `;
          }
        } else {
          const isHuman = m.home === teamName || m.away === teamName;
          html += `
            <div class="match-result ${isHuman ? 'user-match' : ''}">
              <div class="home">${m.home}</div>
              <div class="score">vs</div>
              <div class="away">${m.away || 'BYE'}</div>
            </div>
          `;
        }
      }
      html += '</div></div>';
    }

    // Prize money info
    html += `
      <div class="mt-4 text-muted" style="font-size:12px;">
        Prize money: R1 \u00a3${prizeMoney[0].toLocaleString()} \u2022 R2 \u00a3${prizeMoney[1].toLocaleString()} \u2022 R3 \u00a3${prizeMoney[2].toLocaleString()} \u2022 QF \u00a3${prizeMoney[3].toLocaleString()} \u2022 SF \u00a3${prizeMoney[4].toLocaleString()} \u2022 Final \u00a3${prizeMoney[5].toLocaleString()} \u2022 Winner \u00a3${prizeMoney[6].toLocaleString()}
      </div>
      <div class="text-muted" style="font-size:12px;">
        ${cupKey === 'nationalCup' ? 'Matches played every 5 weeks.' : 'Matches played every 5 weeks (offset from National Cup).'}
      </div>
    `;

    return html;
  }

  // ===== FINANCES =====
  function renderFinances() {
    const state = MTSM_ENGINE.getState();
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const playerWages = team.players.reduce((s, p) => s + p.wage, 0);
    const staffWages = Object.values(team.staff).reduce((s, st) => s + st.wage, 0);

    // Find last home gate income from match results
    let lastGateIncome = null;
    let lastAttendance = null;
    for (const divRes of state.matchResults) {
      for (const r of divRes.results) {
        if (r.isHumanMatch && r.home === team.name) {
          lastGateIncome = r.gateIncome;
          lastAttendance = r.attendance;
        }
      }
    }

    return `
      <div class="panel-header">🏦 FINANCES</div>
      <div style="max-width:400px;">
        <div class="ground-stat">
          <span>Bank Balance</span>
          <span class="${team.balance < 0 ? 'text-danger' : 'text-accent'}" style="font-size:22px;">${formatMoney(team.balance)}</span>
        </div>
        <div class="ground-stat">
          <span>Weekly Player Wages</span>
          <span class="text-danger">-£${playerWages.toLocaleString()}</span>
        </div>
        <div class="ground-stat">
          <span>Weekly Staff Wages</span>
          <span class="text-danger">-£${staffWages.toLocaleString()}</span>
        </div>
        <div class="ground-stat">
          <span>Total Weekly Outgoing</span>
          <span class="text-danger">-£${(playerWages + staffWages).toLocaleString()}</span>
        </div>
        ${lastGateIncome !== null ? `
        <div class="ground-stat mt-4" style="border-top:1px solid var(--color-border);padding-top:12px;">
          <span>Last Home Gate Income</span>
          <span class="text-success">+£${lastGateIncome.toLocaleString()}</span>
        </div>
        <div class="ground-stat">
          <span>Last Home Attendance</span>
          <span class="text-accent">${lastAttendance.toLocaleString()}</span>
        </div>
        ` : `
        <div class="ground-stat mt-4" style="border-top:1px solid var(--color-border);padding-top:12px;">
          <span>Home Gate Income</span>
          <span class="text-muted">No home game yet</span>
        </div>
        `}
        <div class="ground-stat mt-4">
          <span>Weeks Until Bankruptcy</span>
          <span class="${team.balance / (playerWages + staffWages) < 5 ? 'text-danger' : 'text-accent'}">
            ${team.balance > 0 ? Math.floor(team.balance / (playerWages + staffWages)) : '⚠ IN DEBT'}
          </span>
        </div>
      </div>
      <div class="mt-4 text-muted" style="font-size:13px;">
        ⚠ If your balance drops below -£50,000, you will be sacked!<br>
        💡 Home matches generate gate income — upgrade ground capacity to earn more!
      </div>
    `;
  }

  // ===== STAFF =====
  function renderStaff() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();

    return `
      <div class="panel-header">👔 STAFF</div>
      ${MTSM_DATA.STAFF_ROLES.map(role => {
        const staff = team.staff[role];
        const qualityName = MTSM_DATA.STAFF_QUALITIES[staff.quality];
        return `
          <div class="staff-card">
            <div>
              <div class="role">${role}</div>
              <div class="quality">${qualityName}</div>
              <div class="text-muted" style="font-size:12px;">Wage: £${staff.wage.toLocaleString()}/week</div>
            </div>
            <div class="btn-group">
              <button class="btn btn-small" onclick="MTSM_UI._upgradeStaff('${role}')" ${staff.quality >= 4 ? 'disabled style="opacity:0.3"' : ''}>
                Upgrade
              </button>
              <button class="btn btn-small btn-danger" onclick="MTSM_UI._downgradeStaff('${role}')" ${staff.quality <= 0 ? 'disabled style="opacity:0.3"' : ''}>
                Downgrade
              </button>
            </div>
          </div>
        `;
      }).join('')}
      <div class="mt-4 text-muted" style="font-size:13px;">
        <strong>Coach:</strong> Improves training effectiveness<br>
        <strong>Scout:</strong> Finds better transfer targets<br>
        <strong>Physio:</strong> Speeds up injury recovery
      </div>
    `;
  }

  function _upgradeStaff(role) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const result = MTSM_ENGINE.upgradeStaff(role, team);
    showNotification(result.msg, !result.success);
    renderGame('staff');
  }

  function _downgradeStaff(role) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const result = MTSM_ENGINE.downgradeStaff(role, team);
    showNotification(result.msg, !result.success);
    renderGame('staff');
  }

  // ===== GROUND =====
  function renderGround() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const upgrades = MTSM_DATA.GROUND_UPGRADES;

    return `
      <div class="panel-header">🏟️ GROUND</div>
      <div class="ground-visual">
        <pre style="color:var(--color-primary);font-size:13px;line-height:1.3;">
  ╔════════════════════════════╗
  ║  ┌───────────────────┐    ║
  ║  │                   │    ║
  ║  └─────────┬─────────┘    ║
  ║            │              ║
  ║     ○──────┼──────○       ║
  ║            │              ║
  ║  ┌─────────┴─────────┐    ║
  ║  │                   │    ║
  ║  └───────────────────┘    ║
  ╚════════════════════════════╝
        </pre>
        <div class="text-accent" style="font-family:var(--font-display);font-size:11px;">${team.name} Stadium</div>
      </div>

      ${['capacity', 'safety', 'pitch'].map(aspect => {
        const level = team.ground[aspect];
        const maxLevel = upgrades[aspect].levels.length - 1;
        const currentVal = upgrades[aspect].levels[level];
        const nextCost = level < maxLevel ? upgrades[aspect].costs[level + 1] : null;
        const displayVal = typeof currentVal === 'number' ? currentVal.toLocaleString() : currentVal;

        return `
          <div class="ground-stat">
            <span>${aspect.charAt(0).toUpperCase() + aspect.slice(1)}</span>
            <span class="text-accent">${displayVal}</span>
          </div>
          ${nextCost !== null ? `
            <div style="text-align:right;margin-bottom:12px;">
              <button class="btn btn-small" onclick="MTSM_UI._upgradeGround('${aspect}')">
                Upgrade (£${nextCost.toLocaleString()})
              </button>
            </div>
          ` : '<div class="text-muted mb-2" style="text-align:right;font-size:12px;">MAX</div>'}
        `;
      }).join('')}
    `;
  }

  function _upgradeGround(aspect) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const result = MTSM_ENGINE.upgradeGround(aspect, team);
    showNotification(result.msg, !result.success);
    renderGame('ground');
  }

  // ===== RESULTS =====
  function renderResults() {
    const state = MTSM_ENGINE.getState();
    if (state.matchResults.length === 0) {
      return '<div class="panel-header">📊 LATEST RESULTS</div><div class="text-muted">No matches played yet.</div>';
    }

    return `
      <div class="panel-header">📊 LATEST RESULTS — Week ${state.week - 1}</div>
      ${state.matchResults.map(divRes => `
        <div style="margin-bottom:16px;">
          <div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:8px;">
            DIVISION ${divRes.division + 1}
          </div>
          <div class="match-results">
            ${divRes.results.map(r => {
              const team = MTSM_ENGINE.getCurrentHumanTeam();
              const isHumanHome = r.isHumanMatch && r.home === team.name;
              const isHumanAway = r.isHumanMatch && r.away === team.name;
              return `
              <div class="match-result ${r.isHumanMatch ? 'user-match' : ''}">
                <div class="home">${r.home}${isHumanHome ? ' ★' : ''}</div>
                <div class="score">${r.homeGoals} - ${r.awayGoals}</div>
                <div class="away">${r.away}${isHumanAway ? ' ★' : ''}</div>
              </div>
              ${r.isHumanMatch ? `<div style="font-size:12px;padding:2px 8px 8px;color:var(--color-muted);display:flex;justify-content:space-between;">
                <span>${isHumanHome ? '🏠 HOME' : '✈️ AWAY'}</span>
                <span>Att: ${r.attendance.toLocaleString()}</span>
                ${isHumanHome ? '<span class="text-success">Gate: +£' + r.gateIncome.toLocaleString() + '</span>' : '<span class="text-muted">No gate income (away)</span>'}
              </div>` : ''}`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    `;
  }

  // ===== MATCH DAY =====
  function _playMatchDay() {
    const state = MTSM_ENGINE.getState();

    if (state.seasonOver) {
      _processEndOfSeason();
      return;
    }

    // Play matches
    const results = MTSM_ENGINE.playMatchDay();

    // Show vidiprinter-style results
    _showVidiprinter(results);
  }

  function _showVidiprinter(results) {
    const state = MTSM_ENGINE.getState();
    const hp = state.humanPlayers[state.currentPlayerIndex];

    // Gather all results flat
    const allResults = results.flatMap(d => d.results);

    app().innerHTML = `
      <div class="game-screen">
        <div class="panel-header" style="font-size:14px;text-align:center;">
          ⚽ MATCH DAY — Week ${state.week - 1}
        </div>
        <div class="vidiprinter" id="vidiprinter"></div>
        <div class="text-center mt-4">
          <button class="btn btn-accent" id="continue-btn" style="display:none;" onclick="MTSM_UI._afterMatchDay()">
            CONTINUE
          </button>
        </div>
      </div>
    `;

    const vidi = document.getElementById('vidiprinter');
    let idx = 0;

    function showNext() {
      if (idx >= allResults.length) {
        document.getElementById('continue-btn').style.display = 'inline-block';
        return;
      }
      const r = allResults[idx];
      const line = document.createElement('div');
      line.className = 'result-line';
      const divLabel = `D${r.division + 1}`;
      const team = MTSM_ENGINE.getCurrentHumanTeam();
      const isHumanHome = r.isHumanMatch && r.home === team.name;
      line.innerHTML = `
        <span class="text-muted">[${divLabel}]</span>
        ${r.home} <span class="team-score">${r.homeGoals}</span> — <span class="team-score">${r.awayGoals}</span> ${r.away}
        ${r.isHumanMatch ? ' ★ ' + (isHumanHome ? '🏠 Att: ' + r.attendance.toLocaleString() + ' Gate: +£' + r.gateIncome.toLocaleString() : '✈️ AWAY') : ''}
      `;
      if (r.isHumanMatch) {
        line.style.color = 'var(--color-primary)';
        line.style.fontWeight = 'bold';
      }
      vidi.appendChild(line);
      vidi.scrollTop = vidi.scrollHeight;
      idx++;
      setTimeout(showNext, 120);
    }

    setTimeout(showNext, 500);
  }

  function _afterMatchDay() {
    const state = MTSM_ENGINE.getState();
    if (state.seasonOver) {
      _processEndOfSeason();
    } else {
      renderGame('results');
    }
  }

  function _processEndOfSeason() {
    const result = MTSM_ENGINE.processEndOfSeason();
    const state = MTSM_ENGINE.getState();

    let html = `
      <div class="season-summary">
        <div class="trophy">🏆</div>
        <h2>END OF SEASON ${state.season - 1}</h2>
    `;

    if (result.champion.length > 0) {
      html += `<div class="text-accent mt-4" style="font-size:20px;">Champion: ${result.champion[0].team}</div>`;
    }

    // Group promotions and relegations by division pair
    for (let d = 0; d < 4; d++) {
      const divPromos = result.promotions.filter(p => p.fromDiv === d);
      const divRelegs = result.relegations.filter(r => r.fromDiv === d);
      if (divPromos.length === 0 && divRelegs.length === 0) continue;

      html += `<div class="mt-4"><div class="text-accent" style="font-family:var(--font-display);font-size:11px;">DIVISION ${d + 1}</div>`;
      for (const p of divPromos) {
        html += `<div class="text-success">▲ ${p.team.name} promoted to Division ${p.toDiv + 1}</div>`;
      }
      for (const r of divRelegs) {
        html += `<div class="text-danger">▼ ${r.team.name} relegated to Division ${r.toDiv + 1}</div>`;
      }
      html += '</div>';
    }

    // News
    if (state.news.length > 0) {
      html += `<div class="mt-6 text-left">`;
      for (const n of state.news) {
        html += `<div class="news-item"><span class="event-type">[${n.type}]</span> ${n.text}</div>`;
      }
      html += '</div>';
    }

    html += `
        <div class="mt-6">
          <button class="btn btn-accent" onclick="MTSM_UI.renderGame()">START SEASON ${state.season}</button>
        </div>
      </div>
    `;

    app().innerHTML = html;
  }

  // ===== GAME OVER =====
  function renderGameOver() {
    app().innerHTML = `
      <div class="season-summary">
        <div class="trophy">💀</div>
        <h2>GAME OVER</h2>
        <div class="text-danger mt-4" style="font-size:18px;">All managers have been sacked!</div>
        <div class="mt-6">
          <button class="btn btn-accent" onclick="MTSM_UI.renderTitle()">MAIN MENU</button>
        </div>
      </div>
    `;
  }

  // ===== HELPERS =====
  function formatMoney(amount) {
    return (amount < 0 ? '-' : '') + '£' + Math.abs(amount).toLocaleString();
  }

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  // ===== NOTIFICATION SYSTEM =====
  // Injected into the DOM via renderGame

  // ===== SAVE / LOAD =====
  function _saveGame() {
    const data = MTSM_ENGINE.saveGame();
    if (!data) {
      showNotification('No game to save!', true);
      return;
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const hp = data.humanPlayers[data.currentPlayerIndex];
    const filename = `mtsm_save_s${data.season}_w${data.week}_${(team ? team.name : 'game').replace(/\s+/g, '_')}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(`Game saved: ${filename}`);
  }

  function _triggerLoad() {
    // Reset file input so the same file can be re-selected
    let input = document.getElementById('load-file-input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'load-file-input';
      input.accept = '.json';
      input.style.display = 'none';
      input.addEventListener('change', _handleLoadFile);
      document.body.appendChild(input);
    }
    input.value = '';
    input.click();
  }

  function _handleLoadFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.divisions || !data.humanPlayers) {
          showNotification('Invalid save file!', true);
          return;
        }
        const success = MTSM_ENGINE.loadGame(data);
        if (success) {
          showNotification('Game loaded successfully!');
          renderGame();
        } else {
          showNotification('Failed to load save file!', true);
        }
      } catch (err) {
        showNotification('Error reading save file: ' + err.message, true);
      }
    };
    reader.readAsText(file);
  }

  return {
    renderTitle,
    renderSetup,
    renderGame,
    _setPlayerCount,
    _validateTeamSelection,
    _startGame: _startGame,
    _setTraining,
    _setGroupTraining,
    _filterNews,
    _buyPlayer,
    _sellPlayer,
    _upgradeStaff,
    _downgradeStaff,
    _upgradeGround,
    _playMatchDay,
    _afterMatchDay,
    _transferFilter,
    _showVidiprinter,
    showNotification,
    _saveGame,
    _triggerLoad,
    _handleLoadFile,
    _toggleOption,
    _toggleAllOptions,
    _setFormation,
    _signYouth,
    _submitBid,
    _showNegotiationModal,
    _showCounterOfferModal,
    _toggleXI,
    _autoSelectXI,
    _clearXI,
    _confirmXI
  };

})();

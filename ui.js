/* ========= MTSM UI Layer ========= */
'use strict';

const MTSM_UI = (() => {

  const app = () => document.getElementById('app');
  let currentView = 'title';
  let notification = '';

  // Squad sorting/filtering state
  let _squadSort = { column: 'position', direction: 'asc' };
  let _squadSearch = '';

  // Training sorting state
  let _trainingSort = { column: 'position', direction: 'asc' };

  // ===== CONFIRMATION DIALOG =====
  function _showConfirmDialog(title, message, detail, onConfirm, icon = '⚠️') {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon">${icon}</div>
        <div class="confirm-title">${title}</div>
        <div class="confirm-msg">${message}</div>
        ${detail ? `<div class="confirm-detail">${detail}</div>` : ''}
        <div class="confirm-actions">
          <button class="btn btn-danger" id="confirm-yes">CONFIRM</button>
          <button class="btn" id="confirm-no">CANCEL</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirm-yes').addEventListener('click', () => {
      document.body.removeChild(overlay);
      onConfirm();
    });
    overlay.querySelector('#confirm-no').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  }

  // ===== CLUB LOGO GENERATOR =====
  function _hashName(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function _generateClubLogo(teamName) {
    const h = _hashName(teamName);
    const words = teamName.split(' ');
    const initials = words.length >= 2
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : teamName.substring(0, 2).toUpperCase();

    // Deterministic colours from team name hash
    const hue1 = h % 360;
    const hue2 = (h * 7 + 137) % 360;
    const col1 = `hsl(${hue1}, 70%, 50%)`;
    const col2 = `hsl(${hue2}, 60%, 40%)`;

    // Pick a shield variant based on hash
    const variant = h % 4;
    let decoration = '';
    if (variant === 0) {
      // Horizontal stripe
      decoration = `<rect x="25" y="42" width="50" height="8" fill="${col2}" opacity="0.6"/>`;
    } else if (variant === 1) {
      // Vertical stripe
      decoration = `<rect x="46" y="15" width="8" height="60" fill="${col2}" opacity="0.6"/>`;
    } else if (variant === 2) {
      // Diagonal halves
      decoration = `<polygon points="50,12 78,30 50,78" fill="${col2}" opacity="0.5"/>`;
    } else {
      // Star
      decoration = `<polygon points="50,58 53,65 61,65 55,70 57,77 50,73 43,77 45,70 39,65 47,65" fill="${col2}" opacity="0.7"/>`;
    }

    // Football at top
    const ball = `<circle cx="50" cy="18" r="5" fill="none" stroke="${col2}" stroke-width="1" opacity="0.5"/>`;

    return `<svg viewBox="0 0 100 100" class="club-logo" xmlns="http://www.w3.org/2000/svg">
      <!-- Shield shape -->
      <path d="M50 8 L78 22 L78 55 Q78 78 50 92 Q22 78 22 55 L22 22 Z"
            fill="${col1}" stroke="var(--color-primary)" stroke-width="2"/>
      <path d="M50 12 L75 24 L75 54 Q75 75 50 88 Q25 75 25 54 L25 24 Z"
            fill="${col2}" opacity="0.25"/>
      ${decoration}
      ${ball}
      <!-- Initials -->
      <text x="50" y="48" text-anchor="middle" font-family="var(--font-display)"
            font-size="18" fill="var(--color-text-bright)" letter-spacing="2">${initials}</text>
    </svg>`;
  }

  function showNotification(msg, isError = false, persistent = false) {
    notification = msg;
    const el = document.getElementById('notification');
    if (el) {
      if (persistent) {
        el.innerHTML = `${msg}<button class="notif-dismiss" onclick="this.parentElement.classList.add('hidden');">&times;</button>`;
        el.className = 'notification persistent ' + (isError ? 'error' : 'warning');
        el.classList.remove('hidden');
      } else {
        el.textContent = msg;
        el.className = 'notification ' + (isError ? 'error' : 'success');
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 3000);
      }
    }
  }

  // ===== TITLE SCREEN =====
  function renderTitle() {
    currentView = 'title';
    app().innerHTML = `
      <div class="title-screen">
        <div class="logo-container">
          <div class="logo-shield">
            <div class="shield-outer">
              <div class="shield-inner">
                <div class="shield-ball">⚽</div>
              </div>
            </div>
          </div>
          <div class="logo-text-block">
            <div class="logo-main-title">MULTI</div>
            <div class="logo-divider"></div>
            <div class="logo-sub-title">PSM</div>
          </div>
          <div class="logo-tagline">PLAYER • SOCCER • MANAGER</div>
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

    const hp = state.humanPlayers[state.currentPlayerIndex];

    // Manager is between clubs (viewing offers)
    if (!team && hp && hp._lookingForClub) {
      app().innerHTML = `
        <div class="game-screen">
          <div class="game-header">
            <div>
              <div class="team-name">Free Agent</div>
              <div style="font-size:12px;color:var(--color-text-muted);">Manager: ${hp.name} • Seeking new club</div>
            </div>
          </div>
          <div id="notification" class="notification hidden"></div>
          <div id="game-content" class="panel mt-4">
            ${renderCareer()}
          </div>
        </div>
      `;
      return;
    }

    if (!team) {
      renderGameOver();
      return;
    }

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
              <span class="icon">🥇</span>Division Cup
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
          <button class="icon-btn ${subView === 'history' ? 'active' : ''}" onclick="MTSM_UI.renderGame('history')">
            <span class="icon">📜</span>History
          </button>
          <button class="icon-btn ${subView === 'career' ? 'active' : ''}" onclick="MTSM_UI.renderGame('career')" style="${(state.clubOffers && state.clubOffers[state.currentPlayerIndex] && state.clubOffers[state.currentPlayerIndex].offers && state.clubOffers[state.currentPlayerIndex].offers.length > 0) ? 'border-color:var(--color-accent);' : ''}">
            <span class="icon">🏢</span>Career${(state.clubOffers && state.clubOffers[state.currentPlayerIndex] && state.clubOffers[state.currentPlayerIndex].offers && state.clubOffers[state.currentPlayerIndex].offers.length > 0) ? ' <span style="color:var(--color-accent);font-size:10px;">(' + state.clubOffers[state.currentPlayerIndex].offers.length + ')</span>' : ''}
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
      case 'history': return renderClubHistory();
      case 'career': return renderCareer();
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
  function _sortSquad(column) {
    if (_squadSort.column === column) {
      _squadSort.direction = _squadSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      _squadSort.column = column;
      _squadSort.direction = column === 'name' || column === 'position' ? 'asc' : 'desc';
    }
    renderGame('squad');
  }

  function _filterSquad(search) {
    _squadSearch = search;
    renderGame('squad');
  }

  function renderSquad() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const positions = ['GK', 'DEF', 'MID', 'FWD'];

    // Filter by search
    let players = [...team.players];
    if (_squadSearch) {
      const q = _squadSearch.toLowerCase();
      players = players.filter(p =>
        p.name.toLowerCase().includes(q) || p.position.toLowerCase().includes(q)
      );
    }

    // Sort
    const col = _squadSort.column;
    const dir = _squadSort.direction === 'asc' ? 1 : -1;
    players.sort((a, b) => {
      let va, vb;
      if (col === 'position') {
        va = positions.indexOf(a.position); vb = positions.indexOf(b.position);
      } else if (col === 'name') {
        return dir * a.name.localeCompare(b.name);
      } else if (col === 'age') {
        va = a.age; vb = b.age;
      } else if (col === 'overall') {
        va = a.overall; vb = b.overall;
      } else if (col === 'wage') {
        va = a.wage; vb = b.wage;
      } else if (MTSM_DATA.SKILLS.includes(col)) {
        va = a.skills[col]; vb = b.skills[col];
      } else {
        va = positions.indexOf(a.position); vb = positions.indexOf(b.position);
      }
      if (va === vb) return b.overall - a.overall;
      return dir * (va - vb);
    });

    const sortIcon = (c) => _squadSort.column === c ? (_squadSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    const sortClass = (c) => `sortable ${_squadSort.column === c ? 'sort-active' : ''}`;

    return `
      <div class="panel-header">👥 SQUAD — ${team.players.length}/25 Players</div>
      <div class="squad-controls">
        <input type="text" placeholder="Search players..." value="${_squadSearch}"
          oninput="MTSM_UI._filterSquad(this.value)" style="flex:1;max-width:220px;">
        <span class="text-muted" style="font-size:12px;">Click column headers to sort</span>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th class="${sortClass('position')}" onclick="MTSM_UI._sortSquad('position')">Pos${sortIcon('position')}</th>
              <th class="${sortClass('name')}" onclick="MTSM_UI._sortSquad('name')">Name${sortIcon('name')}</th>
              <th class="${sortClass('age')}" onclick="MTSM_UI._sortSquad('age')">Age${sortIcon('age')}</th>
              <th class="${sortClass('overall')}" onclick="MTSM_UI._sortSquad('overall')">Ovr${sortIcon('overall')}</th>
              ${MTSM_DATA.SKILLS.map(s => `<th class="${sortClass(s)}" onclick="MTSM_UI._sortSquad('${s}')">${s.substring(0, 3)}${sortIcon(s)}</th>`).join('')}
              <th>Pot</th>
              <th class="${sortClass('wage')}" onclick="MTSM_UI._sortSquad('wage')">Wage${sortIcon('wage')}</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${players.map(p => `
              <tr class="${p.injured > 0 ? 'relegation' : ''}">
                <td class="pos-${p.position.toLowerCase()}">${p.position}</td>
                <td>${p.name}</td>
                <td class="num">${p.age}</td>
                <td class="num text-accent">${p.overall}</td>
                ${MTSM_DATA.SKILLS.map(s => `<td class="num">${p.skills[s]}</td>`).join('')}
                <td class="num">${p.isYouth && p.potential ? `<span class="text-success">${p.potential}</span>` : '—'}</td>
                <td class="num">£${p.wage}</td>
                <td>${p.injured > 0 ? `<span class="text-danger">INJ ${p.injured}w</span>` :
                      p.isYouth ? `<span class="text-success">Youth</span>${p.training ? ` — Training ${p.training}` : ''}` :
                      p.training ? `<span class="text-info">Training ${p.training}</span>` : '✓'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${_squadSearch && players.length === 0 ? '<div class="text-muted mt-4" style="text-align:center;">No players match your search.</div>' : ''}
      <div class="mt-4 text-muted" style="font-size:13px;">
        Weekly wages: £${team.players.reduce((s, p) => s + p.wage, 0).toLocaleString()}
        • Avg overall: ${Math.round(team.players.reduce((s, p) => s + p.overall, 0) / team.players.length)}
        • Team strength: ${MTSM_ENGINE.calculateTeamStrength(team).toFixed(1)}
      </div>
    `;
  }

  function _sortTraining(column) {
    if (_trainingSort.column === column) {
      _trainingSort.direction = _trainingSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      _trainingSort.column = column;
      _trainingSort.direction = column === 'name' || column === 'position' ? 'asc' : 'desc';
    }
    renderGame('training');
  }

  // ===== TRAINING =====
  function renderTraining() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const state = MTSM_ENGINE.getState();
    const hpIdx = state.currentPlayerIndex;
    const coachQ = MTSM_DATA.STAFF_QUALITIES[team.staff.Coach.quality];
    const hasAsstCoach = state.assistantCoachData && state.assistantCoachData[hpIdx] && state.assistantCoachData[hpIdx].quality > 0;

    // Sort players
    const positions = ['GK', 'DEF', 'MID', 'FWD'];
    const tCol = _trainingSort.column;
    const tDir = _trainingSort.direction === 'asc' ? 1 : -1;
    const sortedPlayers = [...team.players].sort((a, b) => {
      let va, vb;
      if (tCol === 'position') {
        va = positions.indexOf(a.position); vb = positions.indexOf(b.position);
      } else if (tCol === 'name') {
        return tDir * a.name.localeCompare(b.name);
      } else if (tCol === 'overall') {
        va = a.overall; vb = b.overall;
      } else if (MTSM_DATA.SKILLS.includes(tCol)) {
        va = a.skills[tCol]; vb = b.skills[tCol];
      } else {
        va = positions.indexOf(a.position); vb = positions.indexOf(b.position);
      }
      if (va === vb) return b.overall - a.overall;
      return tDir * (va - vb);
    });

    const tSortIcon = (c) => _trainingSort.column === c ? (_trainingSort.direction === 'asc' ? ' ▲' : ' ▼') : '';
    const tSortClass = (c) => `sortable ${_trainingSort.column === c ? 'sort-active' : ''}`;

    return `
      <div class="panel-header">🏋️ TRAINING — Coach: ${coachQ}</div>
      <div class="text-muted mb-4" style="font-size:13px;">
        Select a skill to train for each player.${hasAsstCoach ? ' If no skill is chosen, the assistant coach auto-assigns based on each player\'s weakest skills.' : ' Better coaches improve training results.'}
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
        <span class="text-muted" style="font-size:12px;margin-left:8px;">Click column headers to sort</span>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th class="${tSortClass('name')}" onclick="MTSM_UI._sortTraining('name')">Player${tSortIcon('name')}</th>
              <th class="${tSortClass('position')}" onclick="MTSM_UI._sortTraining('position')">Pos${tSortIcon('position')}</th>
              <th class="${tSortClass('overall')}" onclick="MTSM_UI._sortTraining('overall')">Ovr${tSortIcon('overall')}</th>
              ${MTSM_DATA.SKILLS.map(s => `<th class="${tSortClass(s)}" onclick="MTSM_UI._sortTraining('${s}')">${s.substring(0, 3)}${tSortIcon(s)}</th>`).join('')}
              <th>Your Choice</th>
              ${hasAsstCoach ? '<th>Active</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${sortedPlayers.map(p => {
              const autoSkill = hasAsstCoach ? MTSM_ENGINE.getAutoTraining(hpIdx, p) : null;
              const acTarget = hasAsstCoach ? (state.assistantCoachData[hpIdx].targetLevel || 99) : 99;
              const userMaxed = p.userTraining && p.skills[p.userTraining] >= acTarget;
              const activeTraining = (p.userTraining && !userMaxed) ? p.userTraining : autoSkill;
              const isAuto = !p.userTraining || userMaxed;
              return `
              <tr>
                <td>${p.name}${p.injured > 0 ? ' <span class="text-danger">(INJ)</span>' : ''}</td>
                <td class="pos-${p.position.toLowerCase()}">${p.position}</td>
                <td class="num text-accent">${p.overall}</td>
                ${MTSM_DATA.SKILLS.map(s => `<td class="num">${p.skills[s]}</td>`).join('')}
                <td>
                  <select onchange="MTSM_UI._setTraining('${p.id}', this.value)" style="font-size:12px;padding:2px 4px;">
                    <option value="">— None —</option>
                    ${MTSM_DATA.SKILLS.map(s => `<option value="${s}" ${p.userTraining === s ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                </td>
                ${hasAsstCoach ? `
                  <td class="num" style="font-size:11px;${isAuto ? 'color:var(--color-accent);' : ''}">
                    ${activeTraining ? (isAuto ? activeTraining + ' (auto)' : activeTraining) : '—'}
                  </td>
                ` : ''}
              </tr>
            `;}).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function _setTraining(playerId, skill) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const player = team.players.find(p => p.id === playerId);
    if (player) {
      player.userTraining = skill || null;
      // If user sets a skill, that becomes the active training immediately
      // If user clears it, training will be set by assistant coach next match day
      player.training = skill || player.training;
    }
    renderGame('training');
  }

  function _setGroupTraining(position, skill) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const value = skill === '_none' ? null : (skill || null);
    for (const p of team.players) {
      if (p.position === position) {
        p.userTraining = value;
        p.training = value || p.training;
      }
    }
    renderGame('training');
  }

  // ===== NEWS BOARD =====
  let _newsFilters = new Set(); // empty = show all
  let _newsWeekFilter = 'ALL';

  function renderNewsBoard() {
    const state = MTSM_ENGINE.getState();
    const log = state.newsLog || [];
    const types = [...new Set(log.map(n => n.type))];
    const weekFilters = ['ALL', 'LAST WEEK'];
    const allSelected = _newsFilters.size === 0;

    let filtered = allSelected ? log : log.filter(n => _newsFilters.has(n.type));
    if (_newsWeekFilter === 'LAST WEEK') {
      let targetSeason = state.season;
      let targetWeek = state.week - 1;
      if (targetWeek < 1) {
        targetSeason -= 1;
        // Find max week from previous season entries, fallback to current week
        const prevSeasonWeeks = log.filter(n => n.season === targetSeason).map(n => n.week);
        targetWeek = prevSeasonWeeks.length > 0 ? Math.max(...prevSeasonWeeks) : 1;
      }
      filtered = filtered.filter(n => n.season === targetSeason && n.week === targetWeek);
    }
    const reversed = [...filtered].reverse();

    return `
      <div class="panel-header">📰 NEWS BOARD</div>
      <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
        <span style="font-size:12px;font-weight:bold;margin-right:4px;">Time:</span>
        ${weekFilters.map(w => `
          <button class="btn btn-small${_newsWeekFilter === w ? ' active' : ''}"
            onclick="MTSM_UI._filterNewsWeek('${w}')"
            style="font-size:11px;padding:2px 8px;${_newsWeekFilter === w ? 'background:var(--color-accent);color:var(--color-bg);' : ''}">
            ${w}
          </button>
        `).join('')}
        <span style="font-size:12px;font-weight:bold;margin:0 4px 0 12px;">Type:</span>
        <button class="btn btn-small${allSelected ? ' active' : ''}"
          onclick="MTSM_UI._filterNews('ALL')"
          style="font-size:11px;padding:2px 8px;${allSelected ? 'background:var(--color-accent);color:var(--color-bg);' : ''}">
          ALL
        </button>
        ${types.map(t => `
          <button class="btn btn-small${_newsFilters.has(t) ? ' active' : ''}"
            onclick="MTSM_UI._filterNews('${t}')"
            style="font-size:11px;padding:2px 8px;${_newsFilters.has(t) ? 'background:var(--color-accent);color:var(--color-bg);' : ''}">
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
    if (type === 'ALL') {
      _newsFilters.clear();
    } else if (_newsFilters.has(type)) {
      _newsFilters.delete(type);
    } else {
      _newsFilters.add(type);
    }
    renderGame('news');
  }

  function _filterNewsWeek(period) {
    _newsWeekFilter = period;
    renderGame('news');
  }

  // ===== TRANSFERS =====
  let _transferFilter = { position: '', minOvr: 0, maxOvr: 99, minAge: 0, maxAge: 99, maxPrice: Infinity };

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
    if (_transferFilter.maxOvr < 99) {
      filtered = filtered.filter(p => p.overall <= _transferFilter.maxOvr);
    }
    if (_transferFilter.minAge > 0) {
      filtered = filtered.filter(p => p.age >= _transferFilter.minAge);
    }
    if (_transferFilter.maxAge < 99) {
      filtered = filtered.filter(p => p.age <= _transferFilter.maxAge);
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
          <option value="70" ${_transferFilter.minOvr === 70 ? 'selected' : ''}>70+</option>
          <option value="80" ${_transferFilter.minOvr === 80 ? 'selected' : ''}>80+</option>
          <option value="90" ${_transferFilter.minOvr === 90 ? 'selected' : ''}>90+</option>
        </select>
        <select onchange="MTSM_UI._transferFilter.maxOvr=parseInt(this.value)||99;MTSM_UI.renderGame('transfers');">
          <option value="99">Max Overall: Any</option>
          <option value="90" ${_transferFilter.maxOvr === 90 ? 'selected' : ''}>90-</option>
          <option value="80" ${_transferFilter.maxOvr === 80 ? 'selected' : ''}>80-</option>
          <option value="70" ${_transferFilter.maxOvr === 70 ? 'selected' : ''}>70-</option>
          <option value="60" ${_transferFilter.maxOvr === 60 ? 'selected' : ''}>60-</option>
          <option value="50" ${_transferFilter.maxOvr === 50 ? 'selected' : ''}>50-</option>
          <option value="40" ${_transferFilter.maxOvr === 40 ? 'selected' : ''}>40-</option>
          <option value="30" ${_transferFilter.maxOvr === 30 ? 'selected' : ''}>30-</option>
        </select>
        <select onchange="MTSM_UI._transferFilter.minAge=parseInt(this.value)||0;MTSM_UI.renderGame('transfers');">
          <option value="0">Min Age: Any</option>
          <option value="16" ${_transferFilter.minAge === 16 ? 'selected' : ''}>16+</option>
          <option value="20" ${_transferFilter.minAge === 20 ? 'selected' : ''}>20+</option>
          <option value="24" ${_transferFilter.minAge === 24 ? 'selected' : ''}>24+</option>
          <option value="28" ${_transferFilter.minAge === 28 ? 'selected' : ''}>28+</option>
          <option value="32" ${_transferFilter.minAge === 32 ? 'selected' : ''}>32+</option>
        </select>
        <select onchange="MTSM_UI._transferFilter.maxAge=parseInt(this.value)||99;MTSM_UI.renderGame('transfers');">
          <option value="99">Max Age: Any</option>
          <option value="20" ${_transferFilter.maxAge === 20 ? 'selected' : ''}>20-</option>
          <option value="24" ${_transferFilter.maxAge === 24 ? 'selected' : ''}>24-</option>
          <option value="28" ${_transferFilter.maxAge === 28 ? 'selected' : ''}>28-</option>
          <option value="32" ${_transferFilter.maxAge === 32 ? 'selected' : ''}>32-</option>
          <option value="36" ${_transferFilter.maxAge === 36 ? 'selected' : ''}>36-</option>
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
    const player = team.players.find(p => p.id === playerId);
    if (!player) return;

    _showConfirmDialog(
      'SELL PLAYER',
      `Sell <strong>${player.name}</strong> (${player.position}, OVR ${player.overall}) for <strong>£${player.value.toLocaleString()}</strong>?`,
      `This action cannot be undone. Your squad will have ${team.players.length - 1} players.`,
      () => {
        const result = MTSM_ENGINE.sellPlayer(playerId, team);
        if (result.success) {
          showNotification(result.msg);
        } else {
          showNotification(result.msg, true);
        }
        renderGame('transfers');
      },
      '💰'
    );
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
        'custom': 'Best OVR. Picks top 11 regardless of position.',
        '4-4-2': 'Balanced. No bonus — the safe default.',
        '4-3-3': 'Attacking width. +3 with enough forwards.',
        '3-5-2': 'Midfield overload. +4 midfield bonus.',
        '5-3-2': 'Defensive wall. +3 from packed defence.',
        '4-5-1': 'Control. +3 midfield, +1 defensive.',
        '3-4-3': 'All-out attack. +4 forward bonus.'
      };
      // Build detailed bonus info for selected formation
      const activeFormation = formations[currentFormation];
      const activeBonusEntries = Object.entries(activeFormation.bonus || {});
      const startingPlayers_ = (team.startingXI || []).map(id => team.players.find(p => p.id === id && p.injured === 0)).filter(Boolean);
      const posCountsForBonus = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
      startingPlayers_.forEach(p => { posCountsForBonus[p.position] = (posCountsForBonus[p.position] || 0) + 1; });

      let bonusDetailHtml = '';
      if (activeFormation.isAuto) {
        const cf = activeFormation;
        const shape = cf.DEF || cf.MID || cf.FWD
          ? `${cf.DEF}-${cf.MID}-${cf.FWD}`
          : 'not yet derived';
        bonusDetailHtml = `<div class="no-bonus">Custom formation (${shape}) — picks best OVR XI. No position bonuses.</div>`;
      } else if (activeBonusEntries.length === 0) {
        bonusDetailHtml = `<div class="no-bonus">No position bonuses — balanced default formation.</div>`;
      } else {
        bonusDetailHtml = activeBonusEntries.map(([pos, bonus]) => {
          const required = activeFormation[pos] || 0;
          const current = posCountsForBonus[pos] || 0;
          const met = current >= required;
          return `<div class="bonus-rule">
            <span>Need ${required}+ ${pos} in starting XI (you have ${current})</span>
            <span class="bonus-value" style="color:${met ? 'var(--color-success)' : 'var(--color-text-muted)'};">${met ? `+${bonus} ACTIVE` : `+${bonus} (unmet)`}</span>
          </div>`;
        }).join('');
      }

      // Midfield loading bonus info
      const midCount = posCountsForBonus.MID || 0;
      let midBonusHtml = `<div class="bonus-rule">
        <span>Midfield loading: 5+ MID in XI (you have ${midCount})</span>
        <span class="bonus-value" style="color:${midCount >= 5 ? 'var(--color-success)' : 'var(--color-text-muted)'};">${midCount >= 5 ? '+5 ACTIVE' : '+5 (unmet)'}</span>
      </div>`;
      if (midCount >= 6) {
        midBonusHtml += `<div class="bonus-rule">
          <span>Midfield overload: 6+ MID in XI</span>
          <span class="bonus-value" style="color:var(--color-success);">+3 ACTIVE</span>
        </div>`;
      }

      formationHtml = `
        <div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:8px;">FORMATION</div>
        <div class="formation-grid mb-4">
          ${Object.keys(formations).map(f => {
            const fData = formations[f];
            const isCustom = !!fData.isAuto;
            const bonusEntries = Object.entries(fData.bonus || {});
            const bonusSummary = bonusEntries.length === 0 ? 'No bonus' :
              bonusEntries.map(([pos, val]) => `+${val} if ${fData[pos]}+ ${pos}`).join(', ');
            const layoutStr = isCustom && fData.DEF === 0 && fData.MID === 0 && fData.FWD === 0
              ? '<span class="pos-gk">GK</span><span class="pos-def">? DEF</span><span class="pos-mid">? MID</span><span class="pos-fwd">? FWD</span>'
              : `<span class="pos-gk">GK</span><span class="pos-def">${fData.DEF} DEF</span><span class="pos-mid">${fData.MID} MID</span><span class="pos-fwd">${fData.FWD} FWD</span>`;
            return `
            <div class="formation-card ${f === currentFormation ? 'formation-active' : ''}${isCustom ? ' formation-custom' : ''}" onclick="MTSM_UI._setFormation('${f}')">
              <div class="formation-name">${isCustom ? 'CUSTOM' : f}</div>
              <div class="formation-layout">${layoutStr}</div>
              <div class="formation-desc">${formationDescriptions[f] || ''}</div>
              <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">${isCustom ? 'Derived from best OVR XI' : `Bonus: ${bonusSummary}`}</div>
              ${f === currentFormation ? '<div class="text-accent" style="font-size:10px;font-family:var(--font-display);margin-top:4px;">SELECTED</div>' : ''}
            </div>
          `}).join('')}
        </div>
        <div class="formation-bonus-info mb-4">
          <div style="font-family:var(--font-display);font-size:9px;color:var(--color-accent);margin-bottom:4px;">STRENGTH BONUSES FOR ${activeFormation.isAuto ? 'CUSTOM (BEST OVR)' : currentFormation}</div>
          ${bonusDetailHtml}
          <div style="border-top:1px solid var(--color-border);margin-top:4px;padding-top:4px;font-family:var(--font-display);font-size:9px;color:var(--color-accent);">UNIVERSAL BONUSES</div>
          ${midBonusHtml}
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
        ${(() => {
          const formations = MTSM_ENGINE.FORMATIONS;
          const fKey = team.formation;
          const isFormationBased = state.options.formationStrategy && fKey && formations[fKey] && !formations[fKey].isAuto;
          const btnLabel = isFormationBased ? `AUTO-SELECT BEST XI (${fKey})` : 'AUTO-SELECT BEST XI (OVR)';
          return `<button class="btn btn-small" onclick="MTSM_UI._autoSelectXI()">${btnLabel}</button>`;
        })()}
        <button class="btn btn-small" onclick="MTSM_UI._clearXI()">CLEAR ALL</button>
        <button class="btn btn-small btn-accent" onclick="MTSM_UI._confirmXI()" ${selectedCount !== 11 ? 'disabled style="opacity:0.4"' : ''}>CONFIRM XI</button>
      </div>

      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th></th><th>Pos</th><th>Name</th><th>Age</th><th>Ovr</th>
              ${MTSM_DATA.SKILLS.map(s => `<th>${s.substring(0, 3)}</th>`).join('')}
              <th>Status</th>
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
                  <td class="num text-accent">${p.overall}</td>
                  ${MTSM_DATA.SKILLS.map(s => `<td class="num">${p.skills[s]}</td>`).join('')}
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
                <td class="num">${p.overall}</td>
                ${MTSM_DATA.SKILLS.map(s => `<td class="num">${p.skills[s]}</td>`).join('')}
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
    const ad = (state.youthAcademyData && state.youthAcademyData[hpIdx]) || { quality: 0, youthCoach: 0 };

    const acQuality = ad.quality;
    const acLevelName = MTSM_DATA.ACADEMY_QUALITY.levels[acQuality];
    const acNextCost = acQuality < 4 ? MTSM_DATA.ACADEMY_QUALITY.costs[acQuality + 1] : null;
    const acMaxCap = MTSM_DATA.ACADEMY_QUALITY.maxCapacity[acQuality];

    const ycQuality = ad.youthCoach;
    const ycLevelName = MTSM_DATA.YOUTH_COACH_QUALITY.levels[ycQuality];
    const ycWage = MTSM_DATA.YOUTH_COACH_QUALITY.costs[ycQuality];

    const yacQuality = ad.asstCoach || 0;
    const yacLevelName = MTSM_DATA.ASST_COACH_QUALITY.levels[yacQuality];
    const yacWage = MTSM_DATA.ASST_COACH_QUALITY.costs[yacQuality];

    return `
      <div class="panel-header">🌱 YOUTH ACADEMY — ${academy.length}/${acMaxCap} prospect${academy.length !== 1 ? 's' : ''}</div>
      <div class="text-muted mb-4" style="font-size:13px;">Young players with potential. Low stats now but they develop faster. New prospects arrive every 4 weeks (up to capacity). Sign or release to make room.</div>

      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
        <div class="staff-card" style="flex:1;min-width:200px;">
          <div>
            <div class="role">Academy Quality</div>
            <div class="quality">${acLevelName}</div>
            <div class="text-muted" style="font-size:12px;">Better academy = higher base skills & more prospects</div>
          </div>
          <div>
            ${acNextCost !== null ? `
              <button class="btn btn-small" onclick="MTSM_UI._upgradeAcademy()">
                Upgrade (£${acNextCost.toLocaleString()})
              </button>
            ` : '<span class="text-muted" style="font-size:12px;">MAX</span>'}
          </div>
        </div>
        <div class="staff-card" style="flex:1;min-width:200px;">
          <div>
            <div class="role">Youth Coach</div>
            <div class="quality">${ycLevelName}</div>
            <div class="text-muted" style="font-size:12px;">${ycQuality > 0 ? `Wage: £${ycWage.toLocaleString()}/week — Trains prospects while in academy` : 'Hire a youth coach to train prospects before signing'}</div>
          </div>
          <div class="btn-group">
            <button class="btn btn-small" onclick="MTSM_UI._upgradeYouthCoach()" ${ycQuality >= 4 ? 'disabled style="opacity:0.3"' : ''}>
              ${ycQuality === 0 ? 'Hire' : 'Upgrade'}
            </button>
            ${ycQuality > 0 ? `
              <button class="btn btn-small btn-danger" onclick="MTSM_UI._downgradeYouthCoach()">
                ${ycQuality === 1 ? 'Dismiss' : 'Downgrade'}
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
        <div class="staff-card" style="flex:1;min-width:300px;flex-direction:column;align-items:stretch;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <div class="role">Youth Assistant Coach</div>
              <div class="quality">${yacLevelName}</div>
              <div class="text-muted" style="font-size:12px;">${yacQuality > 0 ? `Wage: £${yacWage.toLocaleString()}/week — Auto-manages prospect training` : 'Hire to automatically manage prospect training focus'}</div>
            </div>
            <div class="btn-group">
              <button class="btn btn-small" onclick="MTSM_UI._upgradeYouthAsstCoach()" ${yacQuality >= 4 ? 'disabled style="opacity:0.3"' : ''}>
                ${yacQuality === 0 ? 'Hire' : 'Upgrade'}
              </button>
              ${yacQuality > 0 ? `
                <button class="btn btn-small btn-danger" onclick="MTSM_UI._downgradeYouthAsstCoach()">
                  ${yacQuality === 1 ? 'Dismiss' : 'Downgrade'}
                </button>
              ` : ''}
            </div>
          </div>
          ${yacQuality > 0 ? `
            <div style="border-top:1px solid var(--color-border);padding-top:8px;font-size:12px;">
              <div class="text-muted" style="margin-bottom:6px;">
                Automatically trains each prospect's two weakest skills individually. When a skill reaches the target level, switches to that prospect's next weakest skill.
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <label style="font-size:11px;">Target level:
                  <input type="number" id="yac-target" min="1" max="99" value="${ad.asstTargetLevel || 99}"
                    onchange="MTSM_UI._setYouthAsstCoachConfig()" style="width:45px;font-size:11px;padding:2px;">
                </label>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      ${academy.length === 0 ? '<div class="text-muted text-center" style="padding:20px;">No prospects available. Check back in a few weeks.</div>' : `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Pos</th><th>Name</th><th>Age</th>
                ${MTSM_DATA.SKILLS.map(s => `<th>${s.substring(0, 3)}</th>`).join('')}
                <th>Ovr</th><th>Pot</th><th>Fee</th><th>Wage</th>
                ${ycQuality > 0 ? '<th>Your Choice</th>' : ''}
                ${ycQuality > 0 && yacQuality > 0 ? '<th>Active</th>' : ''}
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${academy.map((p, idx) => {
                const yAutoSkill = yacQuality > 0 ? MTSM_ENGINE.getYouthAutoTraining(hpIdx, p) : null;
                const yacTarget = yacQuality > 0 ? (ad.asstTargetLevel || 99) : 99;
                const yUserMaxed = p.userTraining && p.skills[p.userTraining] >= yacTarget;
                const yActiveTraining = (p.userTraining && !yUserMaxed) ? p.userTraining : yAutoSkill;
                const yIsAuto = !p.userTraining || yUserMaxed;
                return `
                <tr>
                  <td class="pos-${p.position.toLowerCase()}">${p.position}</td>
                  <td>${p.name}</td>
                  <td class="num">${p.age}</td>
                  ${MTSM_DATA.SKILLS.map(s => `<td class="num">${p.skills[s]}</td>`).join('')}
                  <td class="num text-accent">${p.overall}</td>
                  <td class="num text-success">${p.potential}</td>
                  <td class="num">£${p.value.toLocaleString()}</td>
                  <td class="num">£${p.wage.toLocaleString()}</td>
                  ${ycQuality > 0 ? `
                    <td>
                      <select onchange="MTSM_UI._setYouthTraining(${idx}, this.value)" style="font-size:11px;padding:2px;">
                        <option value="">—</option>
                        ${MTSM_DATA.SKILLS.map(s => `<option value="${s}" ${p.userTraining === s ? 'selected' : ''}>${s.substring(0,3)}</option>`).join('')}
                      </select>
                    </td>
                  ` : ''}
                  ${ycQuality > 0 && yacQuality > 0 ? `
                    <td class="num" style="font-size:11px;${yIsAuto ? 'color:var(--color-accent);' : ''}">
                      ${yActiveTraining ? (yIsAuto ? yActiveTraining.substring(0,3) + ' (auto)' : yActiveTraining.substring(0,3)) : '—'}
                    </td>
                  ` : ''}
                  <td>
                    <button class="btn btn-small" onclick="MTSM_UI._signYouth(${idx})" ${team.players.length >= 25 ? 'disabled style="opacity:0.3"' : ''}>Sign</button>
                    <button class="btn btn-small btn-danger" onclick="MTSM_UI._releaseYouth(${idx})" style="margin-left:4px;">✕</button>
                  </td>
                </tr>
              `;}).join('')}
            </tbody>
          </table>
        </div>
        <div class="mt-4 text-muted" style="font-size:12px;">
          ⭐ Potential shows the ceiling. Higher potential = faster growth during training.
          ${ycQuality > 0 ? '🏋️ Youth coach trains selected skill each week.' : ''}
          Squad: ${team.players.length}/25
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

  function _releaseYouth(idx) {
    const state = MTSM_ENGINE.getState();
    const result = MTSM_ENGINE.releaseYouthPlayer(idx, state.currentPlayerIndex);
    showNotification(result.msg, !result.success);
    renderGame('academy');
  }

  function _upgradeAcademy() {
    const state = MTSM_ENGINE.getState();
    const result = MTSM_ENGINE.upgradeAcademyQuality(state.currentPlayerIndex);
    showNotification(result.msg, !result.success);
    renderGame('academy');
  }

  function _upgradeYouthCoach() {
    const state = MTSM_ENGINE.getState();
    const result = MTSM_ENGINE.upgradeYouthCoach(state.currentPlayerIndex);
    showNotification(result.msg, !result.success);
    renderGame('academy');
  }

  function _downgradeYouthCoach() {
    const state = MTSM_ENGINE.getState();
    const academy = state.youthAcademy ? state.youthAcademy[state.currentPlayerIndex] : null;
    const ycQuality = academy ? (academy.youthCoachQuality || 0) : 0;
    const currentName = MTSM_DATA.STAFF_QUALITIES[ycQuality] || 'None';
    const action = ycQuality === 1 ? 'Dismiss' : 'Downgrade';

    _showConfirmDialog(
      `${action.toUpperCase()} YOUTH COACH`,
      `${action} your youth coach from <strong>${currentName}</strong>?`,
      'This will reduce training speed for youth academy prospects.',
      () => {
        const result = MTSM_ENGINE.downgradeYouthCoach(state.currentPlayerIndex);
        showNotification(result.msg, !result.success);
        renderGame('academy');
      },
      '📉'
    );
  }

  function _setYouthTraining(idx, skill) {
    const state = MTSM_ENGINE.getState();
    const hpIdx = state.currentPlayerIndex;
    if (state.youthAcademy && state.youthAcademy[hpIdx] && state.youthAcademy[hpIdx][idx]) {
      const player = state.youthAcademy[hpIdx][idx];
      player.userTraining = skill || null;
      player.training = skill || player.training;
    }
    renderGame('academy');
  }

  function _upgradeYouthAsstCoach() {
    const state = MTSM_ENGINE.getState();
    const result = MTSM_ENGINE.upgradeYouthAssistantCoach(state.currentPlayerIndex);
    showNotification(result.msg, !result.success);
    renderGame('academy');
  }

  function _downgradeYouthAsstCoach() {
    const state = MTSM_ENGINE.getState();
    const ad = state.youthAcademyData ? state.youthAcademyData[state.currentPlayerIndex] : null;
    const currentName = ad ? MTSM_DATA.ASST_COACH_QUALITY.levels[ad.asstCoach || 0] : 'None';
    const action = ad && (ad.asstCoach || 0) === 1 ? 'Dismiss' : 'Downgrade';

    _showConfirmDialog(
      `${action.toUpperCase()} YOUTH ASSISTANT COACH`,
      `${action} your Youth Assistant Coach from <strong>${currentName}</strong>?`,
      'This will reduce automatic training management for academy prospects.',
      () => {
        const result = MTSM_ENGINE.downgradeYouthAssistantCoach(state.currentPlayerIndex);
        showNotification(result.msg, !result.success);
        renderGame('academy');
      },
      '📉'
    );
  }

  function _setYouthAsstCoachConfig() {
    const state = MTSM_ENGINE.getState();
    const target = document.getElementById('yac-target');
    if (!target) return;
    const result = MTSM_ENGINE.setYouthAssistantCoachConfig(
      state.currentPlayerIndex,
      parseInt(target.value) || 99
    );
    if (!result.success) showNotification(result.msg, true);
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

    // Human team status
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const teamName = team ? team.name : '';
    const isEliminated = divCup.eliminated && divCup.eliminated.includes(teamName);
    const isWinner = divCup.winner === teamName;
    if (teamName) {
      cupHtml += `<div style="margin-bottom:12px;padding:8px;border:1px solid var(--color-border);border-radius:4px;font-size:13px;">`;
      if (isWinner) {
        cupHtml += `<span class="text-success">Your team won the Division Cup!</span>`;
      } else if (isEliminated) {
        cupHtml += `<span class="text-danger">${teamName} has been eliminated.</span>`;
      } else if (divCup.finished) {
        cupHtml += `<span class="text-muted">${teamName} was eliminated.</span>`;
      } else {
        cupHtml += `<span class="text-success">${teamName} is still in the Division Cup.</span>`;
      }
      cupHtml += `</div>`;
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

    // Helper to get division label for a team
    const getDivLabel = (teamName) => {
      const divIdx = MTSM_ENGINE.findTeamDivisionIndex(teamName);
      return `<span class="text-muted" style="font-size:10px;opacity:0.7;"> (D${divIdx + 1})</span>`;
    };

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
            const homeDivLabel = result.homeDivision ? `<span class="text-muted" style="font-size:10px;opacity:0.7;"> (D${result.homeDivision})</span>` : getDivLabel(result.home);
            const awayDivLabel = result.away === 'BYE' ? '' : (result.awayDivision ? `<span class="text-muted" style="font-size:10px;opacity:0.7;"> (D${result.awayDivision})</span>` : getDivLabel(result.away));
            html += `
              <div class="match-result ${isHuman ? 'user-match' : ''}">
                <div class="home ${result.winner === result.home ? 'text-accent' : ''}">${result.home}${homeDivLabel}</div>
                <div class="score">${result.homeGoals} - ${result.awayGoals}</div>
                <div class="away ${result.winner === result.away ? 'text-accent' : ''}">${result.away}${awayDivLabel}</div>
              </div>
            `;
          }
        } else {
          const isHuman = m.home === teamName || m.away === teamName;
          const homeDivLabel = getDivLabel(m.home);
          const awayDivLabel = m.away ? getDivLabel(m.away) : '';
          html += `
            <div class="match-result ${isHuman ? 'user-match' : ''}">
              <div class="home">${m.home}${homeDivLabel}</div>
              <div class="score">vs</div>
              <div class="away">${m.away || 'BYE'}${awayDivLabel}</div>
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
    const hp = state.humanPlayers[state.currentPlayerIndex];
    const playerWages = team.players.reduce((s, p) => s + p.wage, 0);
    const staffWages = Object.values(team.staff).reduce((s, st) => s + st.wage, 0);

    // Get weekly finances for this team
    const weeklyEntries = (state.weeklyFinances && state.weeklyFinances[state.currentPlayerIndex]) || [];
    const incomeEntries = weeklyEntries.filter(e => e.type === 'income');
    const expenseEntries = weeklyEntries.filter(e => e.type === 'expense');
    const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
    const totalExpenses = expenseEntries.reduce((s, e) => s + e.amount, 0);

    return `
      <div class="panel-header">🏦 FINANCES</div>
      <div style="max-width:400px;">
        <div class="ground-stat">
          <span>Bank Balance</span>
          <span class="${team.balance < 0 ? 'text-danger' : 'text-accent'}" style="font-size:22px;">${formatMoney(team.balance)}</span>
        </div>
        <div class="ground-stat mt-4">
          <span>Weeks Until Bankruptcy</span>
          <span class="${team.balance / (playerWages + staffWages) < 5 ? 'text-danger' : 'text-accent'}">
            ${team.balance > 0 ? Math.floor(team.balance / (playerWages + staffWages)) : '⚠ IN DEBT'}
          </span>
        </div>
        ${weeklyEntries.length > 0 ? `
        <div style="border-top:1px solid var(--color-border);margin-top:12px;padding-top:12px;">
          <div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:8px;">
            THIS WEEK'S BANK STATEMENT (Week ${state.week - 1})
          </div>
          ${incomeEntries.length > 0 ? incomeEntries.map(e => `
          <div class="ground-stat">
            <span>${e.label}</span>
            <span class="text-success">+\u00a3${e.amount.toLocaleString()}</span>
          </div>
          `).join('') : ''}
          ${expenseEntries.length > 0 ? expenseEntries.map(e => `
          <div class="ground-stat">
            <span>${e.label}</span>
            <span class="text-danger">-\u00a3${e.amount.toLocaleString()}</span>
          </div>
          `).join('') : ''}
          <div class="ground-stat" style="border-top:1px solid var(--color-border);padding-top:8px;margin-top:4px;">
            <span style="font-weight:bold;">Net This Week</span>
            <span class="${totalIncome - totalExpenses >= 0 ? 'text-success' : 'text-danger'}" style="font-weight:bold;">
              ${totalIncome - totalExpenses >= 0 ? '+' : '-'}\u00a3${Math.abs(totalIncome - totalExpenses).toLocaleString()}
            </span>
          </div>
        </div>
        ` : `
        <div style="border-top:1px solid var(--color-border);margin-top:12px;padding-top:12px;">
          <div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:8px;">
            THIS WEEK'S BANK STATEMENT
          </div>
          <div class="text-muted">No transactions yet — play a match day!</div>
        </div>
        `}
        <div style="border-top:1px solid var(--color-border);margin-top:12px;padding-top:12px;">
          <div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:8px;">
            WEEKLY OUTGOINGS
          </div>
          <div class="ground-stat">
            <span>Player Wages</span>
            <span class="text-danger">-\u00a3${playerWages.toLocaleString()}</span>
          </div>
          <div class="ground-stat">
            <span>Staff Wages</span>
            <span class="text-danger">-\u00a3${staffWages.toLocaleString()}</span>
          </div>
          <div class="ground-stat">
            <span>Total Weekly Outgoing</span>
            <span class="text-danger">-\u00a3${(playerWages + staffWages).toLocaleString()}</span>
          </div>
        </div>
      </div>
      ${team.loan && team.loan.remaining > 0 ? `
        <div style="border-top:1px solid var(--color-border);margin-top:12px;padding-top:12px;">
          <div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:8px;">
            EMERGENCY LOAN
          </div>
          <div class="ground-stat">
            <span>Original Loan</span>
            <span>\u00a3${team.loan.original.toLocaleString()}</span>
          </div>
          <div class="ground-stat">
            <span>Remaining</span>
            <span class="text-danger">\u00a3${team.loan.remaining.toLocaleString()}</span>
          </div>
          <div class="ground-stat">
            <span>Weekly Repayment</span>
            <span class="text-danger">-\u00a3${team.loan.weeklyRepayment.toLocaleString()}/wk</span>
          </div>
          <div class="ground-stat">
            <span>Weeks to Clear</span>
            <span>${Math.ceil(team.loan.remaining / team.loan.weeklyRepayment)}</span>
          </div>
          <div style="margin-top:8px;">
            <label style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);">ADJUST REPAYMENT TERM</label>
            <select style="width:100%;padding:6px;margin-top:4px;margin-bottom:8px;" onchange="MTSM_UI._changeLoanTerm(parseInt(this.value))">
              ${[30,40,60,90,120,150].map(w => {
                const currentWeeks = team.loan.repaymentWeeks || 40;
                return `<option value="${w}" ${w === currentWeeks ? 'selected' : ''}>${w} weeks (~${(w/30).toFixed(1)} seasons)${w === 30 ? ' — fastest' : w === 150 ? ' — easiest' : ''}</option>`;
              }).join('')}
            </select>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-small" onclick="MTSM_UI._repayLoan(5000)">Repay \u00a35,000</button>
            <button class="btn btn-small" onclick="MTSM_UI._repayLoan(${team.loan.remaining})">Repay All (\u00a3${team.loan.remaining.toLocaleString()})</button>
          </div>
        </div>
      ` : ''}
      <div class="mt-4 text-muted" style="font-size:13px;">
        ⚠ If your balance drops below -\u00a350,000, you will be sacked!<br>
        💡 Home matches generate gate income — upgrade ground capacity to earn more!
      </div>
    `;
  }

  function _showLoanTermsModal(loanAmount) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'loan-terms-modal';
    const defaultWeeks = 40;
    const defaultWeekly = Math.max(500, Math.round(loanAmount / defaultWeeks));
    modal.innerHTML = `
      <div class="modal">
        <h3>EMERGENCY LOAN</h3>
        <div style="margin-bottom:16px;">
          <div class="text-muted" style="font-size:13px;margin-bottom:8px;">
            Your new club is in debt. An emergency loan of <strong class="text-accent">\u00a3${loanAmount.toLocaleString()}</strong> will be issued.
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);">REPAYMENT TERM</label>
            <select id="loan-weeks-select" style="width:100%;padding:8px;margin-top:4px;" onchange="
              var w = parseInt(this.value);
              var weekly = Math.max(500, Math.round(${loanAmount} / w));
              document.getElementById('loan-preview-weekly').textContent = '\u00a3' + weekly.toLocaleString() + '/week';
              document.getElementById('loan-preview-total-weeks').textContent = Math.ceil(${loanAmount} / weekly) + ' weeks';
              document.getElementById('loan-preview-seasons').textContent = '~' + (w / 30).toFixed(1) + ' seasons';
            ">
              <option value="30">30 weeks (~1 season) — fastest</option>
              <option value="40" selected>40 weeks (~1.3 seasons)</option>
              <option value="60">60 weeks (~2 seasons)</option>
              <option value="90">90 weeks (~3 seasons)</option>
              <option value="120">120 weeks (~4 seasons)</option>
              <option value="150">150 weeks (~5 seasons) — easiest</option>
            </select>
          </div>
          <div class="ground-stat" style="margin-bottom:4px;">
            <span>Weekly Repayment</span>
            <span class="text-danger" id="loan-preview-weekly">-\u00a3${defaultWeekly.toLocaleString()}/week</span>
          </div>
          <div class="ground-stat" style="margin-bottom:4px;">
            <span>Weeks to Clear</span>
            <span id="loan-preview-total-weeks">${Math.ceil(loanAmount / defaultWeekly)} weeks</span>
          </div>
          <div class="ground-stat">
            <span>Approx. Seasons</span>
            <span id="loan-preview-seasons">~${(defaultWeeks / 30).toFixed(1)} seasons</span>
          </div>
        </div>
        <div class="btn-group" style="justify-content:center;">
          <button class="btn btn-accent" onclick="MTSM_UI._confirmLoanTerms()">ACCEPT LOAN</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function _confirmLoanTerms() {
    const select = document.getElementById('loan-weeks-select');
    const weeks = select ? parseInt(select.value) : 40;
    const modal = document.getElementById('loan-terms-modal');
    if (modal) modal.remove();

    const team = MTSM_ENGINE.getCurrentHumanTeam();
    if (team) {
      const loanInfo = MTSM_ENGINE.confirmEmergencyLoan(team, weeks);
      if (loanInfo) {
        showNotification(`Emergency loan of \u00a3${loanInfo.loanAmount.toLocaleString()} issued — repay \u00a3${loanInfo.weeklyRepayment.toLocaleString()}/week over ~${loanInfo.weeksToRepay} weeks.`);
      }
    }
    renderGame('finances');
  }

  function _changeLoanTerm(weeks) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    if (!team) return;
    const result = MTSM_ENGINE.setLoanRepaymentTerm(team, weeks);
    if (result.success) {
      showNotification(result.msg);
    } else {
      showNotification(result.msg, true);
    }
    renderGame('finances');
  }

  // ===== STAFF =====
  function _repayLoan(amount) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    if (!team) return;
    const result = MTSM_ENGINE.repayLoanEarly(team, amount);
    if (result.success) {
      showNotification(result.msg);
      if (result.cleared) {
        showNotification('Loan fully repaid! No more weekly deductions.');
      }
    } else {
      showNotification(result.msg, true);
    }
    renderGame('finances');
  }

  function renderStaff() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const state = MTSM_ENGINE.getState();
    const hpIdx = state.currentPlayerIndex;
    const ac = (state.assistantCoachData && state.assistantCoachData[hpIdx]) || { quality: 0, targetLevel: 99 };
    const acQuality = ac.quality || 0;
    const acLevelName = MTSM_DATA.ASST_COACH_QUALITY.levels[acQuality];
    const acWage = MTSM_DATA.ASST_COACH_QUALITY.costs[acQuality];

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

      <div class="staff-card" style="margin-top:12px;flex-direction:column;align-items:stretch;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <div class="role">Assistant Coach</div>
            <div class="quality">${acLevelName}</div>
            <div class="text-muted" style="font-size:12px;">${acQuality > 0 ? `Wage: £${acWage.toLocaleString()}/week — Auto-manages player training` : 'Hire to automatically manage player training focus'}</div>
          </div>
          <div class="btn-group">
            <button class="btn btn-small" onclick="MTSM_UI._upgradeAsstCoach()" ${acQuality >= 4 ? 'disabled style="opacity:0.3"' : ''}>
              ${acQuality === 0 ? 'Hire' : 'Upgrade'}
            </button>
            ${acQuality > 0 ? `
              <button class="btn btn-small btn-danger" onclick="MTSM_UI._downgradeAsstCoach()">
                ${acQuality === 1 ? 'Dismiss' : 'Downgrade'}
              </button>
            ` : ''}
          </div>
        </div>
        ${acQuality > 0 ? `
          <div style="border-top:1px solid var(--color-border);padding-top:8px;font-size:12px;">
            <div class="text-muted" style="margin-bottom:6px;">
              Automatically trains each player's two weakest skills individually. When a skill reaches the target level, switches to that player's next weakest skill.
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <label style="font-size:11px;">Target level:
                <input type="number" id="ac-target" min="1" max="99" value="${ac.targetLevel || 99}"
                  onchange="MTSM_UI._setAsstCoachConfig()" style="width:45px;font-size:11px;padding:2px;">
              </label>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="mt-4 text-muted" style="font-size:13px;">
        <strong>Coach:</strong> Improves training effectiveness<br>
        <strong>Assistant Coach:</strong> Auto-trains each player's weakest skills individually<br>
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
    const currentQuality = MTSM_DATA.STAFF_QUALITIES[team.staff[role].quality];
    const newQuality = team.staff[role].quality > 0 ? MTSM_DATA.STAFF_QUALITIES[team.staff[role].quality - 1] : 'None';

    _showConfirmDialog(
      `DOWNGRADE ${role.toUpperCase()}`,
      `Downgrade your ${role} from <strong>${currentQuality}</strong> to <strong>${newQuality}</strong>?`,
      role === 'Coach' ? 'This will reduce training effectiveness and team strength.' :
      role === 'Scout' ? 'This will reduce your ability to find discounted players.' :
      'This will slow down injury recovery for your players.',
      () => {
        const result = MTSM_ENGINE.downgradeStaff(role, team);
        showNotification(result.msg, !result.success);
        renderGame('staff');
      },
      '📉'
    );
  }

  function _upgradeAsstCoach() {
    const state = MTSM_ENGINE.getState();
    const result = MTSM_ENGINE.upgradeAssistantCoach(state.currentPlayerIndex);
    showNotification(result.msg, !result.success);
    renderGame('staff');
  }

  function _downgradeAsstCoach() {
    const state = MTSM_ENGINE.getState();
    const ac = state.assistantCoachData ? state.assistantCoachData[state.currentPlayerIndex] : null;
    const currentName = ac ? MTSM_DATA.ASST_COACH_QUALITY.levels[ac.quality] : 'None';
    const action = ac && ac.quality === 1 ? 'Dismiss' : 'Downgrade';

    _showConfirmDialog(
      `${action.toUpperCase()} ASSISTANT COACH`,
      `${action} your Assistant Coach from <strong>${currentName}</strong>?`,
      'This will reduce automatic training management for your players.',
      () => {
        const result = MTSM_ENGINE.downgradeAssistantCoach(state.currentPlayerIndex);
        showNotification(result.msg, !result.success);
        renderGame('staff');
      },
      '📉'
    );
  }

  function _setAsstCoachConfig() {
    const state = MTSM_ENGINE.getState();
    const target = document.getElementById('ac-target');
    if (!target) return;
    const result = MTSM_ENGINE.setAssistantCoachConfig(
      state.currentPlayerIndex,
      parseInt(target.value) || 99
    );
    if (!result.success) showNotification(result.msg, true);
  }

  // ===== GROUND =====
  function renderGround() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const upgrades = MTSM_DATA.GROUND_UPGRADES;

    return `
      <div class="panel-header">🏟️ GROUND</div>
      <div class="ground-visual">
        ${_generateClubLogo(team.name)}
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

  // ===== CLUB RECORDS HELPER =====
  function renderRecordsSection(history) {
    if (history.length === 0) return '';

    const hasMatchRecords = history.some(h => h.records);

    // Best winning streak (all-time)
    let bestWinStreak = { value: 0, season: 0 };
    let worstLoseStreak = { value: 0, season: 0 };
    let bestUnbeatenRun = { value: 0, season: 0 };
    let worstWinlessRun = { value: 0, season: 0 };
    let mostCleanSheets = { value: 0, season: 0 };
    let bestBigWin = null;
    let worstBigLoss = null;
    let bestHighScoring = null;
    let mostGoalsSeason = { value: 0, season: 0 };
    let fewestGoalsConceded = { value: Infinity, season: 0 };
    let mostPointsSeason = { value: 0, season: 0 };
    let bestGDSeason = { value: -Infinity, season: 0 };
    let mostWinsSeason = { value: 0, season: 0 };
    let mostLossesSeason = { value: Infinity, season: 0 }; // "worst" = most losses
    let fewestLossesSeason = { value: Infinity, season: 0 };

    for (const h of history) {
      // Season-level records (always available)
      if (h.goalsFor > mostGoalsSeason.value) {
        mostGoalsSeason = { value: h.goalsFor, season: h.season };
      }
      if (h.goalsAgainst < fewestGoalsConceded.value) {
        fewestGoalsConceded = { value: h.goalsAgainst, season: h.season };
      }
      if (h.points > mostPointsSeason.value) {
        mostPointsSeason = { value: h.points, season: h.season };
      }
      const gd = h.goalsFor - h.goalsAgainst;
      if (gd > bestGDSeason.value) {
        bestGDSeason = { value: gd, season: h.season };
      }
      if (h.won > mostWinsSeason.value) {
        mostWinsSeason = { value: h.won, season: h.season };
      }
      if (h.lost < fewestLossesSeason.value) {
        fewestLossesSeason = { value: h.lost, season: h.season };
      }

      if (!h.records) continue;
      const r = h.records;

      if (r.winStreak > bestWinStreak.value) {
        bestWinStreak = { value: r.winStreak, season: h.season };
      }
      if (r.loseStreak > worstLoseStreak.value) {
        worstLoseStreak = { value: r.loseStreak, season: h.season };
      }
      if (r.unbeatenRun > bestUnbeatenRun.value) {
        bestUnbeatenRun = { value: r.unbeatenRun, season: h.season };
      }
      if (r.winlessRun > worstWinlessRun.value) {
        worstWinlessRun = { value: r.winlessRun, season: h.season };
      }
      if (r.cleanSheets > mostCleanSheets.value) {
        mostCleanSheets = { value: r.cleanSheets, season: h.season };
      }

      if (r.biggestWin && (!bestBigWin || r.biggestWin.diff > bestBigWin.diff || (r.biggestWin.diff === bestBigWin.diff && r.biggestWin.goalsFor > bestBigWin.goalsFor))) {
        bestBigWin = { ...r.biggestWin, season: h.season };
      }
      if (r.biggestLoss && (!worstBigLoss || r.biggestLoss.diff < worstBigLoss.diff || (r.biggestLoss.diff === worstBigLoss.diff && r.biggestLoss.goalsAgainst > worstBigLoss.goalsAgainst))) {
        worstBigLoss = { ...r.biggestLoss, season: h.season };
      }
      if (r.highestScoring && (!bestHighScoring || r.highestScoring.total > bestHighScoring.total)) {
        bestHighScoring = { ...r.highestScoring, season: h.season };
      }
    }

    function matchScore(rec) {
      if (!rec) return '<span class="text-muted">—</span>';
      const venue = rec.isHome ? '(H)' : '(A)';
      return `${rec.goalsFor}-${rec.goalsAgainst} vs ${rec.opponent} ${venue} <span class="text-muted">S${rec.season}</span>`;
    }

    const rows = [];

    // Streaks section (only if match-level records exist)
    if (hasMatchRecords) {
      rows.push({ label: 'Best winning streak', value: `${bestWinStreak.value} games`, season: bestWinStreak.season, icon: '🔥' });
      rows.push({ label: 'Longest unbeaten run', value: `${bestUnbeatenRun.value} games`, season: bestUnbeatenRun.season, icon: '🛡' });
      if (worstLoseStreak.value > 0) {
        rows.push({ label: 'Worst losing streak', value: `${worstLoseStreak.value} games`, season: worstLoseStreak.season, icon: '💀' });
      }
      if (worstWinlessRun.value > 0) {
        rows.push({ label: 'Longest winless run', value: `${worstWinlessRun.value} games`, season: worstWinlessRun.season, icon: '😰' });
      }

      // Match records
      rows.push({ label: 'Biggest win', value: matchScore(bestBigWin), icon: '💪' });
      rows.push({ label: 'Biggest loss', value: matchScore(worstBigLoss), icon: '😬' });
      rows.push({ label: 'Highest scoring match', value: matchScore(bestHighScoring), icon: '⚽' });
      rows.push({ label: 'Most clean sheets', value: `${mostCleanSheets.value}`, season: mostCleanSheets.season, icon: '🚫' });
    }

    // Season records (always available from base history data)
    rows.push({ label: 'Most points in a season', value: `${mostPointsSeason.value} pts`, season: mostPointsSeason.season, icon: '📊' });
    rows.push({ label: 'Most wins in a season', value: `${mostWinsSeason.value}`, season: mostWinsSeason.season, icon: '✅' });
    rows.push({ label: 'Fewest losses in a season', value: `${fewestLossesSeason.value}`, season: fewestLossesSeason.season, icon: '🏅' });
    rows.push({ label: 'Most goals in a season', value: `${mostGoalsSeason.value} goals`, season: mostGoalsSeason.season, icon: '🎯' });
    rows.push({ label: 'Fewest goals conceded', value: `${fewestGoalsConceded.value} goals`, season: fewestGoalsConceded.season, icon: '🧤' });
    rows.push({ label: 'Best goal difference', value: `${bestGDSeason.value > 0 ? '+' : ''}${bestGDSeason.value}`, season: bestGDSeason.season, icon: '📈' });

    // Win rate
    const totalW = history.reduce((s, h) => s + h.won, 0);
    const totalP = history.reduce((s, h) => s + h.played, 0);
    const winPct = totalP > 0 ? ((totalW / totalP) * 100).toFixed(1) : '0.0';
    rows.push({ label: 'Career win rate', value: `${winPct}%`, icon: '📋' });

    return `
      <div style="margin-bottom:20px;padding:12px;border:1px solid var(--color-border);border-radius:4px;">
        <div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:8px;">ALL-TIME RECORDS</div>
        <table class="data-table" style="font-size:13px;">
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="width:24px;text-align:center;">${r.icon}</td>
                <td>${r.label}</td>
                <td class="text-accent" style="text-align:right;">${r.value}</td>
                ${r.season ? `<td class="text-muted" style="text-align:right;font-size:11px;width:40px;">S${r.season}</td>` : '<td></td>'}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ===== CLUB HISTORY =====
  function renderClubHistory() {
    const state = MTSM_ENGINE.getState();
    const hpIdx = state.currentPlayerIndex;
    const hp = state.humanPlayers[hpIdx];
    const history = (state.clubHistory && state.clubHistory[hpIdx]) || [];
    const team = MTSM_ENGINE.getCurrentHumanTeam();

    // Count total trophies (guard against old saves missing trophies field)
    const allTrophies = history.flatMap(h => h.trophies || []);
    const totalTrophies = allTrophies.length;

    // Count clubs managed
    const clubsManaged = new Set(history.map(h => h.club || team.name));

    // Count trophies by type
    const trophyCounts = {};
    for (const t of allTrophies) {
      trophyCounts[t] = (trophyCounts[t] || 0) + 1;
    }

    if (history.length === 0) {
      return `
        <div class="panel-header">📜 MANAGER HISTORY — ${hp.name}</div>
        <div class="text-muted" style="padding:20px;text-align:center;">
          No history yet. Complete a season to see your career record here.
        </div>
      `;
    }

    return `
      <div class="panel-header">📜 MANAGER HISTORY — ${hp.name}</div>
      <div style="color:var(--color-text-muted);font-size:12px;margin-bottom:12px;">
        Currently at <span style="color:var(--color-text-bright);">${team.name}</span> (Division ${hp.division + 1})
        ${clubsManaged.size > 1 ? ` · ${clubsManaged.size} clubs managed` : ''}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:20px;">
        <div>
          <div class="text-muted" style="font-size:12px;">TOTAL TROPHIES</div>
          <div class="text-accent" style="font-size:32px;font-family:var(--font-display);">🏆 ${totalTrophies}</div>
        </div>
        <div>
          <div class="text-muted" style="font-size:12px;">SEASONS MANAGED</div>
          <div style="font-size:28px;font-family:var(--font-display);">${history.length}</div>
        </div>
        <div>
          <div class="text-muted" style="font-size:12px;">BEST FINISH</div>
          <div style="font-size:28px;font-family:var(--font-display);">
            ${(() => {
              const best = [...history].sort((a, b) => a.division - b.division || a.position - b.position)[0];
              return `${best.position}${ordinal(best.position)} <span class="text-muted" style="font-size:14px;">Div ${best.division}</span>`;
            })()}
          </div>
        </div>
        <div>
          <div class="text-muted" style="font-size:12px;">HIGHEST DIVISION</div>
          <div style="font-size:28px;font-family:var(--font-display);">Division ${Math.min(...history.map(h => h.division))}</div>
        </div>
      </div>

      ${totalTrophies > 0 ? `
        <div style="margin-bottom:20px;padding:12px;border:1px solid var(--color-accent);border-radius:4px;">
          <div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:8px;">TROPHY CABINET</div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;">
            ${Object.entries(trophyCounts).map(([name, count]) => `
              <div style="text-align:center;padding:8px 12px;border:1px solid var(--color-border);border-radius:4px;">
                <div style="font-size:24px;">🏆</div>
                <div style="font-size:12px;color:var(--color-accent);">${name}</div>
                <div style="font-size:11px;color:var(--color-text-muted);">x${count}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div style="font-family:var(--font-display);font-size:10px;color:var(--color-accent);margin-bottom:8px;">SEASON BY SEASON</div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Season</th><th>Club</th><th>Div</th><th>Pos</th><th>P</th><th>W</th><th>D</th><th>L</th>
              <th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Trophies</th>
            </tr>
          </thead>
          <tbody>
            ${[...history].reverse().map(h => {
              const gd = h.goalsFor - h.goalsAgainst;
              return `
                <tr>
                  <td class="num text-accent">${h.season}</td>
                  <td style="font-size:11px;white-space:nowrap;">${h.club || team.name}</td>
                  <td class="num">${h.division}</td>
                  <td class="num">${h.position}${ordinal(h.position)}</td>
                  <td class="num">${h.played}</td>
                  <td class="num">${h.won}</td>
                  <td class="num">${h.drawn}</td>
                  <td class="num">${h.lost}</td>
                  <td class="num">${h.goalsFor}</td>
                  <td class="num">${h.goalsAgainst}</td>
                  <td class="num">${gd > 0 ? '+' : ''}${gd}</td>
                  <td class="num">${h.points}</td>
                  <td>${(h.trophies || []).length > 0 ? (h.trophies || []).map(t => `<span class="text-accent" style="font-size:12px;">🏆 ${t}</span>`).join('<br>') : '<span class="text-muted">—</span>'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${renderRecordsSection(history)}

      <div class="mt-4 text-muted" style="font-size:12px;">
        Total record: ${history.reduce((s, h) => s + h.won, 0)}W ${history.reduce((s, h) => s + h.drawn, 0)}D ${history.reduce((s, h) => s + h.lost, 0)}L
        • ${history.reduce((s, h) => s + h.goalsFor, 0)} goals scored
        • ${history.reduce((s, h) => s + h.goalsAgainst, 0)} goals conceded
      </div>
    `;
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
            ${divRes.cupName ? divRes.cupName.toUpperCase() : `DIVISION ${divRes.division + 1}`}
          </div>
          <div class="match-results">
            ${divRes.results.map(r => {
              const team = MTSM_ENGINE.getCurrentHumanTeam();
              const isHumanHome = r.isHumanMatch && r.home === team.name;
              const isHumanAway = r.isHumanMatch && r.away === team.name;
              let resultClass = '';
              if (r.isHumanMatch) {
                const humanGoals = isHumanHome ? r.homeGoals : r.awayGoals;
                const opponentGoals = isHumanHome ? r.awayGoals : r.homeGoals;
                if (humanGoals > opponentGoals) resultClass = 'user-win';
                else if (humanGoals < opponentGoals) resultClass = 'user-loss';
                else resultClass = 'user-draw';
              }
              const homeDivTag = divRes.cupName && r.homeDivision ? `<span class="text-muted" style="font-size:10px;opacity:0.7;"> (D${r.homeDivision})</span>` : '';
              const awayDivTag = divRes.cupName && r.awayDivision ? `<span class="text-muted" style="font-size:10px;opacity:0.7;"> (D${r.awayDivision})</span>` : '';
              return `
              <div class="match-result ${r.isHumanMatch ? 'user-match' : ''} ${resultClass}">
                <div class="home">${r.home}${homeDivTag}${isHumanHome ? ' ★' : ''}</div>
                <div class="score">${r.homeGoals} - ${r.awayGoals}</div>
                <div class="away">${r.away}${awayDivTag}${isHumanAway ? ' ★' : ''}</div>
              </div>
              ${r.isHumanMatch ? `<div style="font-size:12px;padding:2px 8px 8px;color:var(--color-muted);display:flex;justify-content:space-between;">
                <span>${isHumanHome ? '🏠 HOME' : '✈️ AWAY'}</span>
                <span>Att: ${r.attendance.toLocaleString()}</span>
                ${divRes.cupName
                  ? '<span class="text-success">Gate: +£' + Math.floor(r.gateIncome * 0.5).toLocaleString() + ' (50%)</span>'
                  : (isHumanHome ? '<span class="text-success">Gate: +£' + r.gateIncome.toLocaleString() + '</span>' : '<span class="text-muted">No gate income (away)</span>')}
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

    // Gather all results flat, carrying cup/division label
    const allResults = results.flatMap(d => d.results.map(r => ({...r, division: r.division !== undefined ? r.division : d.division, cupName: d.cupName || null})));

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
      const divLabel = r.cupName ? r.cupName : `D${r.division + 1}`;
      const team = MTSM_ENGINE.getCurrentHumanTeam();
      const isHumanHome = r.isHumanMatch && r.home === team.name;
      const humanGateIncome = r.cupName
        ? Math.floor(r.gateIncome * 0.5)
        : r.gateIncome;
      const homeDiv = r.cupName && r.homeDivision ? ` (D${r.homeDivision})` : '';
      const awayDiv = r.cupName && r.awayDivision ? ` (D${r.awayDivision})` : '';
      line.innerHTML = `
        <span class="text-muted">[${divLabel}]</span>
        ${r.home}${homeDiv} <span class="team-score">${r.homeGoals}</span> — <span class="team-score">${r.awayGoals}</span> ${r.away}${awayDiv}
        ${r.isHumanMatch ? ' ★ ' + (r.cupName
          ? '🏆 Att: ' + r.attendance.toLocaleString() + ' Gate: +£' + humanGateIncome.toLocaleString() + ' (50%)'
          : (isHumanHome ? '🏠 Att: ' + r.attendance.toLocaleString() + ' Gate: +£' + r.gateIncome.toLocaleString() : '✈️ AWAY')) : ''}
      `;
      if (r.isHumanMatch) {
        const humanGoals = isHumanHome ? r.homeGoals : r.awayGoals;
        const opponentGoals = isHumanHome ? r.awayGoals : r.homeGoals;
        if (humanGoals > opponentGoals) {
          line.style.color = 'var(--color-success)';
        } else if (humanGoals < opponentGoals) {
          line.style.color = 'var(--color-danger)';
        } else {
          line.style.color = 'var(--color-accent)';
        }
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
      // Show persistent notifications for critical events
      _checkCriticalNotifications(state);
    }
  }

  function _checkCriticalNotifications(state) {
    const hp = state.humanPlayers[state.currentPlayerIndex];
    if (!hp || hp.sacked) return;

    const team = MTSM_ENGINE.getCurrentHumanTeam();
    if (!team) return;

    const alerts = [];

    // Board confidence warning
    if (state.options.boardConfidence && hp.boardConfidence <= 25 && hp.boardConfidence > 10) {
      alerts.push(`Board confidence critically low at ${hp.boardConfidence}%! You will be sacked at 10%.`);
    }

    // Bankruptcy warning
    if (team.balance < -30000) {
      alerts.push(`Severe debt: £${Math.abs(team.balance).toLocaleString()}! Bankruptcy (sacking) at -£50,000.`);
    }

    // Key player injuries (any player with overall >= 75)
    const newInjuries = state.news.filter(n => n.type === 'INJURY' || (n.text && n.text.includes('injured')));
    const injuredStars = team.players.filter(p => p.injured > 0 && p.overall >= 75);
    if (injuredStars.length > 0) {
      const names = injuredStars.map(p => `${p.name} (${p.overall} OVR, ${p.injured}w)`).join(', ');
      alerts.push(`Key player${injuredStars.length > 1 ? 's' : ''} injured: ${names}`);
    }

    // Relegation danger (bottom 2 in table)
    const table = MTSM_ENGINE.getLeagueTable(hp.division);
    const teamIdx = table.findIndex(t => t.name === team.name);
    if (teamIdx >= table.length - 2 && state.week >= 10) {
      alerts.push(`Relegation danger! Currently ${teamIdx + 1}${teamIdx === table.length - 1 ? 'st' : 'nd'} from bottom in Division ${hp.division + 1}.`);
    }

    // Transfer market update alert (every 9 weeks)
    if (state.transferMarketAlert) {
      alerts.push('Transfer Market Updated! New players are available on the transfer market.');
      state.transferMarketAlert = false;
    }

    if (alerts.length > 0) {
      showNotification(alerts.join(' | '), true, true);
    }
  }

  function _processEndOfSeason() {
    const state = MTSM_ENGINE.getState();
    const seasonNum = state.season;

    // Snapshot final league tables before stats are reset (deep copy values)
    const finalTables = [0, 1, 2, 3].map(d => MTSM_ENGINE.getLeagueTable(d).map(t => ({
      name: t.name, isHuman: t.isHuman, played: t.played,
      won: t.won, drawn: t.drawn, lost: t.lost,
      goalsFor: t.goalsFor, goalsAgainst: t.goalsAgainst, points: t.points
    })));

    const result = MTSM_ENGINE.processEndOfSeason();

    let html = `
      <div class="season-summary">
        <div class="trophy">🏆</div>
        <h2>END OF SEASON ${seasonNum}</h2>
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

    // Final division tables
    for (let d = 0; d < 4; d++) {
      const table = finalTables[d];
      html += `
        <div class="mt-6">
          <div class="text-accent" style="font-family:var(--font-display);font-size:11px;">DIVISION ${d + 1} - FINAL TABLE</div>
          <div style="overflow-x:auto;">
            <table class="data-table" style="margin-top:4px;">
              <thead>
                <tr>
                  <th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th>
                  <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
                </tr>
              </thead>
              <tbody>
                ${table.map((t, i) => {
                  const isHuman = t.isHuman;
                  const isPromo = i < 2 && d > 0;
                  const isReleg = i >= 14 && d < 3;
                  const isJoker = i === 15 && d === 3;
                  let cls = isHuman ? 'highlight' : isPromo ? 'promotion' : (isReleg || isJoker) ? 'relegation' : '';
                  const gd = t.goalsFor - t.goalsAgainst;
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
                      <td class="num">${gd > 0 ? '+' : ''}${gd}</td>
                      <td class="num text-accent">${t.points}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
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

  // ===== CAREER (RESIGN / CLUB OFFERS) =====
  let _pendingOffers = null;

  function _renderOfferCards(offers, acceptFn) {
    let html = `<div style="display:flex;flex-direction:column;gap:8px;">`;
    for (let i = 0; i < offers.length; i++) {
      const o = offers[i];
      html += `
        <div class="stat-card" style="cursor:pointer;border:1px solid var(--color-border);" onclick="${acceptFn}(${i})">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="color:var(--color-text-bright);font-size:14px;">${o.teamName}</span>
              <span style="color:var(--color-accent);font-size:12px;margin-left:8px;">${o.divisionName}</span>
            </div>
          </div>
          <div style="display:flex;gap:16px;margin-top:6px;font-size:12px;color:var(--color-text-muted);">
            <span>Balance: <span class="${o.balance < 0 ? 'text-danger' : ''}" style="color:var(--color-text-bright);">${formatMoney(o.balance)}</span></span>
            <span>Squad: <span style="color:var(--color-text-bright);">${o.squadSize}</span></span>
            <span>Avg OVR: <span style="color:var(--color-text-bright);">${o.avgOverall}</span></span>
          </div>
          <div style="margin-top:6px;">
            <button class="btn btn-small btn-accent">ACCEPT OFFER</button>
          </div>
        </div>
      `;
    }
    html += `</div>`;
    return html;
  }

  function renderCareer() {
    const state = MTSM_ENGINE.getState();
    const hp = state.humanPlayers[state.currentPlayerIndex];
    const team = MTSM_ENGINE.getCurrentHumanTeam();

    // If manager has resigned and is looking for a club, show only pending offers
    if (hp._lookingForClub || !team) {
      let html = `
        <div class="panel-header">🏢 CAREER MANAGEMENT</div>
        <div class="mt-4" style="padding:8px;">
          <div style="margin-bottom:16px;color:var(--color-accent);font-size:13px;">
            ⚠ You are currently without a club.
          </div>
      `;

      if (_pendingOffers && _pendingOffers.length > 0) {
        html += `
          <div class="panel-header" style="font-size:12px;">📨 CLUB OFFERS (${_pendingOffers.length})</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin:8px 0;">
            Choose a club to manage next.
          </div>
          ${_renderOfferCards(_pendingOffers, 'MTSM_UI._acceptOffer')}
          <div class="mt-4">
            <button class="btn btn-small" onclick="MTSM_UI._cancelOffers()">✕ DECLINE ALL — Go to Division 4</button>
          </div>
        `;
      } else {
        html += `
          <div style="font-size:12px;color:var(--color-text-muted);margin:8px 0;">
            No offers available.
          </div>
          <button class="btn" onclick="MTSM_UI._cancelOffers()">Take a random Division 4 club</button>
        `;
      }

      html += `</div>`;
      return html;
    }

    // Approach offers from other clubs (generated during season, expire after 1 week)
    const approachData = state.clubOffers && state.clubOffers[state.currentPlayerIndex];
    const approachOffers = approachData ? approachData.offers : [];

    let html = `
      <div class="panel-header">🏢 CAREER MANAGEMENT</div>
      <div class="mt-4" style="padding:8px;">
        <div style="margin-bottom:16px;color:var(--color-text-muted);font-size:13px;">
          Current club: <span style="color:var(--color-text-bright);">${team.name}</span> (Division ${hp.division + 1})
        </div>
    `;

    // Show approach offers (clubs that contacted the manager during the season)
    if (approachOffers.length > 0) {
      html += `
        <div class="panel-header" style="font-size:12px;">📬 CLUB APPROACHES (${approachOffers.length})</div>
        <div style="font-size:12px;color:var(--color-text-muted);margin:8px 0;">
          These clubs have approached you to become their manager. Accept to leave your current club, or decline.
          <span style="color:var(--color-accent);">⏳ Offers expire after this week!</span>
        </div>
        ${_renderOfferCards(approachOffers, 'MTSM_UI._acceptApproach')}
        <div class="mt-4">
          <button class="btn btn-small" onclick="MTSM_UI._declineApproaches()">✕ DECLINE ALL APPROACHES</button>
        </div>
      `;
    } else {
      html += `
        <div class="panel-header" style="font-size:12px;">📬 CLUB APPROACHES</div>
        <div style="font-size:12px;color:var(--color-text-muted);margin:8px 0;">
          No clubs have approached you yet. Perform well and clubs will come calling every few weeks.
        </div>
      `;
    }

    html += `
        <div class="panel-header mt-4" style="font-size:12px;">RESIGN FROM CLUB</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
          <button class="btn" onclick="MTSM_UI._confirmResign('retire')" style="text-align:left;">
            🚪 RETIRE — End your management career
          </button>
          <button class="btn" onclick="MTSM_UI._confirmResign('restart')" style="text-align:left;">
            🔄 START OVER — Take a random Division 4 club
          </button>
          <button class="btn" onclick="MTSM_UI._requestOffers()" style="text-align:left;">
            📨 GET OFFERS — Resign and receive 3 club offers based on performance
          </button>
        </div>
    `;

    // Show pending resignation offers if any (from "Get Offers" resign option)
    if (_pendingOffers && _pendingOffers.length > 0) {
      html += `
        <div class="panel-header mt-4" style="font-size:12px;">📨 RESIGNATION OFFERS</div>
        <div style="font-size:12px;color:var(--color-text-muted);margin:8px 0;">
          You have resigned. Choose a club to manage next.
        </div>
        ${_renderOfferCards(_pendingOffers, 'MTSM_UI._acceptOffer')}
        <div class="mt-4">
          <button class="btn btn-small" onclick="MTSM_UI._cancelOffers()">✕ DECLINE ALL — Go to Division 4</button>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  function _acceptApproach(offerIdx) {
    const state = MTSM_ENGINE.getState();
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const approachData = state.clubOffers && state.clubOffers[state.currentPlayerIndex];
    const offers = approachData ? approachData.offers : [];
    if (offerIdx < 0 || offerIdx >= offers.length) return;
    const offer = offers[offerIdx];
    if (!confirm(`Leave ${team.name} to manage ${offer.teamName} (${offer.divisionName})? This is immediate.`)) return;
    const result = MTSM_ENGINE.acceptApproachOffer(state.currentPlayerIndex, offerIdx);
    if (result.success) {
      showNotification(result.msg);
      if (result.needsLoan && result.loanPreview) {
        _showLoanTermsModal(result.loanPreview.loanAmount);
      } else {
        renderGame();
      }
    } else {
      showNotification(result.msg, true);
    }
  }

  function _declineApproaches() {
    const state = MTSM_ENGINE.getState();
    MTSM_ENGINE.declineApproachOffers(state.currentPlayerIndex);
    showNotification('All approach offers declined.');
    renderGame('career');
  }

  function _confirmResign(option) {
    const hp = MTSM_ENGINE.getState().humanPlayers[MTSM_ENGINE.getState().currentPlayerIndex];
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    let title, msg, detail;
    if (option === 'retire') {
      title = 'RETIRE FROM MANAGEMENT';
      msg = `<strong>${hp.name}</strong> will permanently leave <strong>${team.name}</strong>.`;
      detail = 'This cannot be undone. Your managerial career will end.';
    } else {
      title = 'RESIGN AS MANAGER';
      msg = `Leave <strong>${team.name}</strong> and start over with a random Division 4 club?`;
      detail = 'You will lose your current team, squad, and finances.';
    }

    _showConfirmDialog(title, msg, detail, () => {
      _pendingOffers = null;
      const result = MTSM_ENGINE.resignManager(MTSM_ENGINE.getState().currentPlayerIndex, option);
      if (result.success) {
        showNotification(result.msg);
        if (result.retired) {
          const remaining = MTSM_ENGINE.getState().humanPlayers.filter(h => !h.sacked);
          if (remaining.length === 0) {
            renderGameOver();
          } else {
            MTSM_ENGINE.getState().currentPlayerIndex = MTSM_ENGINE.getState().humanPlayers.findIndex(h => !h.sacked);
            renderGame();
          }
        } else if (result.needsLoan && result.loanPreview) {
          _showLoanTermsModal(result.loanPreview.loanAmount);
        } else {
          renderGame();
        }
      } else {
        showNotification(result.msg, true);
      }
    }, option === 'retire' ? '🚪' : '📋');
  }

  function _requestOffers() {
    const state = MTSM_ENGINE.getState();
    const hp = state.humanPlayers[state.currentPlayerIndex];
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    _showConfirmDialog(
      'RESIGN & REQUEST OFFERS',
      `Resign from <strong>${team.name}</strong> and request club offers?`,
      'You will leave your current club immediately and receive up to 3 offers based on your performance.',
      () => { _doRequestOffers(); },
      '📨'
    );
  }

  function _doRequestOffers() {
    const state = MTSM_ENGINE.getState();
    const hp = state.humanPlayers[state.currentPlayerIndex];
    const team = MTSM_ENGINE.getCurrentHumanTeam();

    // Leave current club first
    const oldTeam = state.divisions[hp.division].teams[hp.teamIndex];
    const oldTeamName = oldTeam.name;

    // Generate offers before leaving (so performance is still calculated)
    _pendingOffers = MTSM_ENGINE.generateClubOffers(state.currentPlayerIndex);

    // Now leave the club
    oldTeam.isHuman = false;
    oldTeam.humanPlayerIndex = -1;
    delete oldTeam.humanName;

    // Mark as "looking" — not sacked, but temporarily without a club
    hp._lookingForClub = true;

    if (_pendingOffers.length === 0) {
      // No offers — force restart in div 4
      hp._lookingForClub = false;
      const result = MTSM_ENGINE.resignManager(state.currentPlayerIndex, 'restart');
      showNotification('No clubs made an offer. ' + result.msg, true);
      if (result.needsLoan && result.loanPreview) {
        _showLoanTermsModal(result.loanPreview.loanAmount);
      } else {
        renderGame();
      }
      return;
    }

    showNotification(`You have resigned from ${oldTeamName}. ${_pendingOffers.length} club offers received!`);
    renderGame('career');
  }

  function _acceptOffer(offerIdx) {
    if (!_pendingOffers || offerIdx < 0 || offerIdx >= _pendingOffers.length) return;
    const offer = _pendingOffers[offerIdx];
    const state = MTSM_ENGINE.getState();
    const hp = state.humanPlayers[state.currentPlayerIndex];

    // Verify team is still available
    const targetTeam = state.divisions[offer.division].teams[offer.teamIndex];
    if (!targetTeam || targetTeam.isHuman) {
      showNotification('This club is no longer available.', true);
      return;
    }

    // Join new club
    targetTeam.isHuman = true;
    targetTeam.humanPlayerIndex = state.currentPlayerIndex;
    targetTeam.humanName = hp.name;
    hp.division = offer.division;
    hp.teamIndex = offer.teamIndex;
    hp.boardConfidence = 50;
    hp._lookingForClub = false;

    _pendingOffers = null;
    let msg = `Welcome to ${targetTeam.name}! You are now managing in Division ${offer.division + 1}.`;
    showNotification(msg);

    // Show loan terms modal if club is in debt
    if (targetTeam.balance < 0) {
      const preview = MTSM_ENGINE.getLoanPreview(targetTeam);
      if (preview) {
        _showLoanTermsModal(preview.loanAmount);
        return;
      }
    }
    renderGame();
  }

  function _cancelOffers() {
    const state = MTSM_ENGINE.getState();
    const hp = state.humanPlayers[state.currentPlayerIndex];

    if (!confirm('Decline all offers? You will be assigned a random Division 4 club.')) return;

    _pendingOffers = null;
    hp._lookingForClub = false;

    // Find a random AI team in Division 4
    const div4Teams = state.divisions[3].teams.filter(t => !t.isHuman);
    if (div4Teams.length === 0) {
      hp.sacked = true;
      showNotification('No clubs available. Career over.', true);
      renderGameOver();
      return;
    }
    const newTeam = div4Teams[Math.floor(Math.random() * div4Teams.length)];
    const newTeamIdx = state.divisions[3].teams.indexOf(newTeam);

    newTeam.isHuman = true;
    newTeam.humanPlayerIndex = state.currentPlayerIndex;
    newTeam.humanName = hp.name;
    hp.division = 3;
    hp.teamIndex = newTeamIdx;
    hp.boardConfidence = 50;

    let msg = `You have taken charge of ${newTeam.name} in Division 4.`;
    showNotification(msg);

    // Show loan terms modal if club is in debt
    if (newTeam.balance < 0) {
      const preview = MTSM_ENGINE.getLoanPreview(newTeam);
      if (preview) {
        _showLoanTermsModal(preview.loanAmount);
        return;
      }
    }
    renderGame();
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
    _filterNewsWeek,
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
    _releaseYouth,
    _upgradeAcademy,
    _upgradeYouthCoach,
    _downgradeYouthCoach,
    _setYouthTraining,
    _upgradeAsstCoach,
    _downgradeAsstCoach,
    _setAsstCoachConfig,
    _upgradeYouthAsstCoach,
    _downgradeYouthAsstCoach,
    _setYouthAsstCoachConfig,
    _submitBid,
    _showNegotiationModal,
    _showCounterOfferModal,
    _toggleXI,
    _autoSelectXI,
    _clearXI,
    _confirmXI,
    _confirmResign,
    _requestOffers,
    _acceptOffer,
    _cancelOffers,
    _acceptApproach,
    _declineApproaches,
    _sortSquad,
    _filterSquad,
    _sortTraining,
    _repayLoan,
    _showLoanTermsModal,
    _confirmLoanTerms,
    _changeLoanTerm
  };

})();

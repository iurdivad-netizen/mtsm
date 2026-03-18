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
          <div class="text-muted" style="font-size:14px;">Up to 4 players • 64 teams • 4 divisions</div>
        </div>
      </div>
    `;
  }

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
            ${div4Teams.map((t, idx) => `<option value="${idx}">${t}</option>`).join('')}
          </select>
        </div>
      `;
    }
    // Auto-assign different teams
    for (let i = 0; i < n; i++) {
      document.getElementById(`pteam-${i}`).selectedIndex = i;
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
    for (let i = 0; i < _numPlayers; i++) {
      const name = document.getElementById(`pname-${i}`).value.trim() || `Manager ${i + 1}`;
      const teamIdx = parseInt(document.getElementById(`pteam-${i}`).value);
      if (usedTeams.has(teamIdx)) {
        alert('Each player must select a different team!');
        return;
      }
      usedTeams.add(teamIdx);
      humanPlayers.push({ name, teamIndex: teamIdx });
    }
    MTSM_ENGINE.initGame(humanPlayers);
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
          </div>
        </div>

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

        <div class="icon-menu">
          <button class="icon-btn ${subView === 'squad' ? 'active' : ''}" onclick="MTSM_UI.renderGame('squad')">
            <span class="icon">👥</span>Squad
          </button>
          <button class="icon-btn ${subView === 'training' ? 'active' : ''}" onclick="MTSM_UI.renderGame('training')">
            <span class="icon">🏋️</span>Train
          </button>
          <button class="icon-btn ${subView === 'transfers' ? 'active' : ''}" onclick="MTSM_UI.renderGame('transfers')">
            <span class="icon">💰</span>Transfer
          </button>
          <button class="icon-btn ${subView === 'league' ? 'active' : ''}" onclick="MTSM_UI.renderGame('league')">
            <span class="icon">🏆</span>League
          </button>
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
      case 'transfers': return renderTransfers();
      case 'league': return renderLeague();
      case 'fixtures': return renderFixtures();
      case 'finances': return renderFinances();
      case 'staff': return renderStaff();
      case 'ground': return renderGround();
      case 'results': return renderResults();
      default: return renderMenu();
    }
  }

  // ===== MENU (default) =====
  function renderMenu() {
    const state = MTSM_ENGINE.getState();
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const hp = state.humanPlayers[state.currentPlayerIndex];
    const table = MTSM_ENGINE.getLeagueTable(hp.division);
    const pos = table.findIndex(t => t.name === team.name) + 1;

    let newsHtml = '';
    if (state.news.length > 0) {
      newsHtml = `
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

    return `
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
      ${newsHtml}
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
              <tr>
                <td class="pos-${p.position.toLowerCase()}">${p.position}</td>
                <td>${p.name}</td>
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

  function _buyPlayer(playerId) {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const result = MTSM_ENGINE.buyPlayer(playerId, team);
    if (result.success) {
      showNotification(result.msg);
    } else {
      showNotification(result.msg, true);
    }
    renderGame('transfers');
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
          `).join('')
        }
      </div>
    `;
  }

  // ===== FINANCES =====
  function renderFinances() {
    const team = MTSM_ENGINE.getCurrentHumanTeam();
    const playerWages = team.players.reduce((s, p) => s + p.wage, 0);
    const staffWages = Object.values(team.staff).reduce((s, st) => s + st.wage, 0);

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
        <div class="ground-stat mt-4">
          <span>Weeks Until Bankruptcy</span>
          <span class="${team.balance / (playerWages + staffWages) < 5 ? 'text-danger' : 'text-accent'}">
            ${team.balance > 0 ? Math.floor(team.balance / (playerWages + staffWages)) : '⚠ IN DEBT'}
          </span>
        </div>
      </div>
      <div class="mt-4 text-muted" style="font-size:13px;">
        ⚠ If your balance drops below -£50,000, you will be sacked!
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
            ${divRes.results.map(r => `
              <div class="match-result ${r.isHumanMatch ? 'user-match' : ''}">
                <div class="home">${r.home}</div>
                <div class="score">${r.homeGoals} - ${r.awayGoals}</div>
                <div class="away">${r.away}</div>
              </div>
            `).join('')}
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
      line.innerHTML = `
        <span class="text-muted">[${divLabel}]</span>
        ${r.home} <span class="team-score">${r.homeGoals}</span> — <span class="team-score">${r.awayGoals}</span> ${r.away}
        ${r.isHumanMatch ? ' ★' : ''}
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

    if (result.promotions.length > 0) {
      html += `<div class="mt-4"><div class="text-success" style="font-family:var(--font-display);font-size:11px;">PROMOTIONS</div>`;
      for (const p of result.promotions) {
        html += `<div>${p.team.name} → Division ${p.toDiv + 1}</div>`;
      }
      html += '</div>';
    }

    if (result.relegations.length > 0) {
      html += `<div class="mt-4"><div class="text-danger" style="font-family:var(--font-display);font-size:11px;">RELEGATIONS</div>`;
      for (const r of result.relegations) {
        html += `<div>${r.team.name} → Division ${r.toDiv + 1}</div>`;
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

  return {
    renderTitle,
    renderSetup,
    renderGame,
    _setPlayerCount,
    _validateTeamSelection,
    _startGame: _startGame,
    _setTraining,
    _buyPlayer,
    _sellPlayer,
    _upgradeStaff,
    _downgradeStaff,
    _upgradeGround,
    _playMatchDay,
    _afterMatchDay,
    _transferFilter,
    _showVidiprinter,
    showNotification
  };

})();

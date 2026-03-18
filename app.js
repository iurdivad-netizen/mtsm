/* ========= MTSM App Bootstrap ========= */
'use strict';

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  MTSM_UI.renderTitle();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // If in a sub-view, go back to menu
    if (document.querySelector('.game-screen')) {
      MTSM_UI.renderGame();
    }
  }
});

// Expose for testing
window.render_game_to_text = function() {
  const state = MTSM_ENGINE.getState();
  if (!state) return JSON.stringify({ phase: 'title' });

  const team = MTSM_ENGINE.getCurrentHumanTeam();
  const hp = state.humanPlayers[state.currentPlayerIndex];

  return JSON.stringify({
    phase: state.phase,
    season: state.season,
    week: state.week,
    currentPlayer: hp ? hp.name : null,
    teamName: team ? team.name : null,
    balance: team ? team.balance : null,
    squadSize: team ? team.players.length : null,
    points: team ? team.points : null,
    division: hp ? hp.division + 1 : null,
    seasonOver: state.seasonOver,
    newsCount: state.news.length,
    humanPlayersActive: state.humanPlayers.filter(h => !h.sacked).length
  });
};

window.advanceTime = function(ms) {
  // For testing: simulate match days
  const steps = Math.max(1, Math.round(ms / 1000));
  for (let i = 0; i < steps; i++) {
    const state = MTSM_ENGINE.getState();
    if (state && !state.seasonOver) {
      MTSM_ENGINE.playMatchDay();
    }
  }
};

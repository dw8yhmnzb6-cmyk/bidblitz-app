(function () {
  'use strict';
  const E = window.BidBlitzBubbleIslands;
  const S = window.BidBlitzBubbleProgressSync;
  const KEY = 'bidblitz.bubble.islands.v1';
  const PROGRESS_API = '/api/games/progress/bubble';
  const $ = id => document.getElementById(id);
  const seed = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] || 42;
  };

  let raw = null;
  let storageOK = true;
  try { raw = localStorage.getItem(KEY); } catch { storageOK = false; }
  let profile = E.decode(raw) || E.initial(seed());
  let accountSync = 'pending';
  let syncActive = false;
  let syncQueued = false;

  const boardButtons = [];
  for (let index = 0; index < E.SIZE; index++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bubble';
    button.setAttribute('role', 'gridcell');
    button.addEventListener('click', () => choose(index));
    $('board').append(button);
    boardButtons.push(button);
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
      storageOK = true;
    } catch {
      storageOK = false;
    }
    if (!storageOK) {
      $('save-note').textContent = 'Lokales Speichern ist hier nicht verfügbar.';
    } else if (accountSync === 'account') {
      $('save-note').textContent = 'Level, Sterne und Bestwerte werden im BidBlitz-Konto synchronisiert. Das laufende Spielfeld bleibt lokal.';
    } else if (accountSync === 'error') {
      $('save-note').textContent = 'Lokaler Fortschritt gespeichert. Kontosynchronisierung ist vorübergehend nicht verfügbar.';
    } else if (accountSync === 'guest') {
      $('save-note').textContent = 'Fortschritt wird auf diesem Gerät gespeichert.';
    } else {
      $('save-note').textContent = 'Lokaler Fortschritt gespeichert. Kontosynchronisierung wird geprüft.';
    }
  }

  async function syncAccountProgress() {
    if (!S) return;
    if (syncActive) {
      syncQueued = true;
      return;
    }
    syncActive = true;
    syncQueued = false;
    try {
      const current = await fetch(PROGRESS_API, { credentials: 'include' });
      if (current.status === 401 || current.status === 403) {
        accountSync = 'guest';
        persist();
        return;
      }
      if (!current.ok) throw new Error('progress-load');
      const remote = await current.json();
      const merged = S.merge(profile, remote);
      if (merged.changed) {
        profile = merged.profile;
        persist();
        render();
      }
      const savedResponse = await fetch(PROGRESS_API, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(S.summary(profile)),
      });
      if (!savedResponse.ok) throw new Error('progress-save');
      const saved = await savedResponse.json();
      const confirmed = S.merge(profile, saved);
      if (confirmed.changed) {
        profile = confirmed.profile;
        persist();
        render();
      }
      accountSync = 'account';
      persist();
    } catch {
      accountSync = 'error';
      persist();
    } finally {
      syncActive = false;
      if (syncQueued) {
        syncQueued = false;
        queueMicrotask(syncAccountProgress);
      }
    }
  }

  function currentSpec() {
    return E.levels[profile.active.level - 1];
  }

  function choose(index) {
    if (profile.active.status !== 'playing') return;
    const result = E.pop(profile.active, index);
    if (!result.ok) {
      $('status').textContent = 'Diese Bubble ist allein. Tippe auf mindestens zwei verbundene Bubbles derselben Farbe.';
      return;
    }
    profile = E.complete(profile, result.state);
    persist();
    render();
    if (profile.active.status === 'won') syncAccountProgress();
    $('status').textContent = '+' + result.gained + ' Punkte · ' + result.removed.length + ' Bubbles entfernt.';
  }

  function startLevel(level) {
    const result = E.begin(profile, level, seed());
    if (!result.ok) return;
    profile = result.profile;
    persist();
    render();
    $('status').textContent = 'Neue Insel gestartet. Finde große Bubble-Gruppen für mehr Punkte.';
  }

  function renderBoard() {
    boardButtons.forEach((button, index) => {
      const value = profile.active.board[index];
      button.className = value < 0 ? 'bubble empty' : 'bubble c' + value;
      button.disabled = value < 0 || profile.active.status !== 'playing';
      button.setAttribute('aria-label', value < 0
        ? 'Leeres Feld'
        : 'Bubble Farbe ' + (value + 1) + ', Gruppe ' + E.group(profile.active.board, index).length);
    });
  }

  function renderLevels() {
    $('level-list').replaceChildren();
    E.levels.forEach(spec => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = spec.number;
      button.disabled = spec.number > profile.unlocked;
      if (spec.number === profile.active.level) button.classList.add('active');
      if (profile.best[spec.number - 1] > 0) button.classList.add('done');
      button.setAttribute('aria-label', 'Level ' + spec.number + (button.disabled ? ' gesperrt' : ''));
      button.addEventListener('click', () => startLevel(spec.number));
      $('level-list').append(button);
    });
  }

  function renderResult() {
    const won = profile.active.status === 'won';
    $('result').hidden = profile.active.status === 'playing';
    if (profile.active.status === 'playing') return;
    const stars = E.starsFor(profile.active);
    $('result-stars').textContent = won ? '★'.repeat(stars) : '○';
    $('result-title').textContent = won ? 'Level geschafft!' : 'Inselrunde beendet';
    $('result-text').textContent = won
      ? profile.active.score.toLocaleString('de-DE') + ' Punkte · ' + stars + ' Sterne'
      : 'Das Ziel wurde noch nicht erreicht. Probiere größere Gruppen und andere Reihenfolgen.';
    const nextLevel = Math.min(E.LEVEL_COUNT, profile.active.level + 1);
    $('next').hidden = !won || profile.active.level >= E.LEVEL_COUNT;
    $('next').textContent = 'Weiter zu Level ' + nextLevel;
    $('next').onclick = () => startLevel(nextLevel);
    $('restart').onclick = () => startLevel(profile.active.level);
  }

  function render() {
    const spec = currentSpec();
    $('level').textContent = profile.active.level;
    $('moves').textContent = profile.active.moves;
    $('score').textContent = profile.active.score.toLocaleString('de-DE');
    $('target').textContent = spec.target.toLocaleString('de-DE');
    $('island-name').textContent = spec.island;
    const percent = Math.min(100, profile.active.score / spec.target * 100);
    $('progress').style.width = percent + '%';
    $('progress-text').textContent = profile.active.score.toLocaleString('de-DE') + ' / ' + spec.target.toLocaleString('de-DE');
    renderBoard();
    renderLevels();
    renderResult();
  }

  window.BidBlitzBubblePreview = {
    snapshot: () => JSON.parse(JSON.stringify(profile)),
    startLevel,
  };

  persist();
  render();
  syncAccountProgress();
  if (raw && !E.decode(raw)) $('status').textContent = 'Der gespeicherte Stand war ungültig. Ein neuer Spielstand wurde gestartet.';
}());
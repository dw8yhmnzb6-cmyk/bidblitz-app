(function () {
  'use strict';
  const F = window.BidBlitzFarm;
  const S = window.BidBlitzFarmAccountSync;
  const KEY = 'bidblitz.farm.preview.v1';
  const META_KEY = 'bidblitz.farm.account-sync.v1';
  const PROGRESS_API = '/api/games/progress/farm';
  const $ = id => document.getElementById(id);
  const CROP_ICON = { wheat:'🌾', corn:'🌽', tomato:'🍅', carrot:'🥕' };
  const WEATHER_ICON = { sunny:'☀️', cloudy:'☁️', rain:'🌧️', storm:'⛈️' };
  const WEATHER_NAME = { sunny:'Sonnig', cloudy:'Bewölkt', rain:'Regen', storm:'Gewitter' };
  const SEASON_NAME = { Spring:'Frühling', Summer:'Sommer', Autumn:'Herbst', Winter:'Winter' };
  const seed = () => {
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] || 123456;
    } catch {
      return 123456;
    }
  };

  let raw = null, rawMeta = null;
  let storageOK = true;
  try { raw = localStorage.getItem(KEY); rawMeta = localStorage.getItem(META_KEY); } catch { storageOK = false; }
  let profile = F.decode(raw) || F.initial(seed());
  let accountRevision = 0, accountSync = 'pending', syncActive = false, syncQueued = false;
  try {
    const meta = JSON.parse(rawMeta || '{}');
    if (Number.isInteger(meta.revision) && meta.revision >= 0) accountRevision = meta.revision;
  } catch {}

  function saveMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify({ revision: accountRevision })); } catch {}
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(profile)); storageOK = true; }
    catch { storageOK = false; }
    if (!storageOK) $('save-note').textContent = 'Lokales Speichern ist hier nicht verfügbar.';
    else if (accountSync === 'account') $('save-note').textContent = 'Farm-Spielstand wird im BidBlitz-Konto synchronisiert. Virtuelle Farm-Münzen sind kein Wallet-Guthaben.';
    else if (accountSync === 'error') $('save-note').textContent = 'Lokaler Farm-Spielstand gespeichert. Kontosynchronisierung ist vorübergehend nicht verfügbar.';
    else if (accountSync === 'guest') $('save-note').textContent = 'Farm-Spielstand wird nur auf diesem Gerät gespeichert. Keine Wallet-Verbindung.';
    else $('save-note').textContent = 'Lokaler Farm-Spielstand gespeichert. Kontosynchronisierung wird geprüft.';
  }

  function adoptRemote(remote) {
    if (!remote || !remote.exists || !remote.state) return false;
    const decoded = F.decode(JSON.stringify(remote.state));
    if (!decoded) return false;
    profile = decoded;
    accountRevision = Number.isInteger(remote.revision) ? remote.revision : 0;
    saveMeta();
    persist();
    render();
    return true;
  }

  async function pushFarmState(revision, retries = 1) {
    const response = await fetch(PROGRESS_API, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision, state: profile }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      accountRevision = body.revision || revision + 1;
      saveMeta();
      accountSync = 'account';
      persist();
      return true;
    }
    if (response.status === 409 && body.detail && body.detail.current) {
      const current = body.detail.current;
      if (current.exists && current.state && S.compareProgress(profile, current.state) > 0 && retries > 0) {
        accountRevision = current.revision || 0;
        saveMeta();
        return pushFarmState(accountRevision, retries - 1);
      }
      if (current.exists) adoptRemote(current);
      return false;
    }
    throw new Error('farm-progress-save');
  }

  async function syncAccountProgress() {
    if (!S) return;
    if (syncActive) { syncQueued = true; return; }
    syncActive = true; syncQueued = false;
    try {
      const response = await fetch(PROGRESS_API, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) {
        accountSync = 'guest'; persist(); return;
      }
      if (!response.ok) throw new Error('farm-progress-load');
      const remote = await response.json();

      if (!remote.exists) {
        await pushFarmState(0);
      } else if (S.chooseNewer(profile, remote.state) === 'remote') {
        adoptRemote(remote);
        accountSync = 'account'; persist();
      } else {
        accountRevision = remote.revision || 0;
        saveMeta();
        await pushFarmState(accountRevision);
      }
    } catch {
      accountSync = 'error';
      persist();
    } finally {
      syncActive = false;
      if (syncQueued) { syncQueued = false; queueMicrotask(syncAccountProgress); }
    }
  }

  function persistAndSync() {
    persist();
    syncAccountProgress();
  }

  function renderForecast() {
    const box = $('forecast');
    box.replaceChildren();
    F.forecast(profile, 7).forEach(item => {
      const node = document.createElement('div');
      node.className = 'forecast-day';
      node.innerHTML = '<span>Tag ' + item.day + '</span><b>' + WEATHER_ICON[item.weather] + '</b><span>' + SEASON_NAME[item.season] + '</span>';
      box.append(node);
    });
  }

  function cropOptionText(crop) {
    return crop.name + ' · ' + crop.seedCost + ' Münzen';
  }

  function renderCropSelect() {
    const select = $('crop-select');
    const current = select.value || 'wheat';
    select.replaceChildren();
    Object.values(F.CROPS).forEach(crop => {
      const option = document.createElement('option');
      option.value = crop.id;
      option.textContent = cropOptionText(crop);
      select.append(option);
    });
    select.value = F.CROPS[current] ? current : 'wheat';
  }

  function renderPlots() {
    const box = $('plots');
    box.replaceChildren();
    profile.plots.forEach(plot => {
      const article = document.createElement('article');
      article.className = 'plot ' + (!plot.crop ? 'empty' : '') + (plot.ready ? ' ready' : '');
      const head = document.createElement('div');
      head.className = 'plot-head';
      head.innerHTML = '<span>Feld ' + plot.id + '</span><span>' + (plot.crop ? 'Gesundheit ' + plot.health + '%' : 'Frei') + '</span>';
      article.append(head);

      const icon = document.createElement('div');
      icon.className = 'crop-icon';
      icon.textContent = plot.crop ? CROP_ICON[plot.crop] : '🟫';
      article.append(icon);

      const name = document.createElement('div');
      name.className = 'crop-name';
      name.textContent = plot.crop ? F.CROPS[plot.crop].name : 'Freies Feld';
      article.append(name);

      if (plot.crop) {
        const crop = F.CROPS[plot.crop];
        const progress = document.createElement('div');
        progress.className = 'progress';
        const fill = document.createElement('span');
        fill.style.width = Math.min(100, Math.round((plot.growth / crop.growDays) * 100)) + '%';
        progress.append(fill);
        article.append(progress);

        const health = document.createElement('div');
        health.className = 'health';
        health.textContent = plot.ready ? 'Bereit zur Ernte' : (plot.watered ? 'Bewässert · ' : '') + plot.growth.toFixed(1) + ' / ' + crop.growDays + ' Wachstum';
        article.append(health);
      }

      const actions = document.createElement('div');
      actions.className = 'plot-actions';
      if (!plot.crop) {
        const plant = document.createElement('button');
        plant.type = 'button';
        plant.className = 'primary';
        plant.textContent = 'Pflanzen';
        plant.addEventListener('click', () => {
          const result = F.plant(profile, plot.id, $('crop-select').value);
          if (!result.ok) {
            $('event').textContent = result.reason === 'coins' ? 'Nicht genug virtuelle Farm-Münzen.' : 'Pflanzen nicht möglich.';
            return;
          }
          profile = result.profile;
          persistAndSync();
          render();
        });
        actions.append(plant);
      } else if (plot.ready) {
        const harvest = document.createElement('button');
        harvest.type = 'button';
        harvest.className = 'primary';
        harvest.textContent = 'Ernten';
        harvest.addEventListener('click', () => {
          const result = F.harvest(profile, plot.id);
          if (!result.ok) return;
          profile = result.profile;
          persistAndSync();
          render();
        });
        actions.append(harvest);
      } else {
        const water = document.createElement('button');
        water.type = 'button';
        water.textContent = plot.watered ? 'Bewässert' : 'Bewässern';
        water.disabled = plot.watered;
        water.addEventListener('click', () => {
          const result = F.water(profile, plot.id);
          if (!result.ok) return;
          profile = result.profile;
          persistAndSync();
          render();
        });
        actions.append(water);
      }
      article.append(actions);
      box.append(article);
    });
  }

  function render() {
    $('coins').textContent = profile.coins.toLocaleString('de-DE');
    $('day').textContent = profile.day;
    $('season').textContent = SEASON_NAME[F.SEASONS[profile.season]];
    $('weather').textContent = WEATHER_NAME[profile.weather];
    $('weather-icon').textContent = WEATHER_ICON[profile.weather];
    $('level').textContent = profile.level;
    $('xp').textContent = profile.xp;
    $('harvests').textContent = profile.harvests;
    $('event').textContent = profile.lastEvent || 'Farm bereit.';
    renderForecast();
    renderPlots();
  }

  $('next-day').addEventListener('click', () => {
    const result = F.advanceDay(profile);
    if (!result.ok) return;
    profile = result.profile;
    persistAndSync();
    render();
  });

  renderCropSelect();
  persist();
  render();
  syncAccountProgress();
  window.BidBlitzFarmPreview = {
    snapshot: () => JSON.parse(JSON.stringify(profile)),
    syncProgress: syncAccountProgress,
    plant: (plotId, cropId) => {
      const result = F.plant(profile, plotId, cropId);
      if (result.ok) { profile = result.profile; persistAndSync(); render(); }
      return result.ok;
    },
    water: plotId => {
      const result = F.water(profile, plotId);
      if (result.ok) { profile = result.profile; persistAndSync(); render(); }
      return result.ok;
    },
    nextDay: () => {
      profile = F.advanceDay(profile).profile;
      persistAndSync();
      render();
      return true;
    },
    harvest: plotId => {
      const result = F.harvest(profile, plotId);
      if (result.ok) { profile = result.profile; persistAndSync(); render(); }
      return result.ok;
    },
  };
}());

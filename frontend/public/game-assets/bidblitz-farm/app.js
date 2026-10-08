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
  let conflictRemote = null, conflictBusy = false;
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
    else if (accountSync === 'conflict') $('save-note').textContent = 'Speicherkonflikt: Zwei Geräte haben unterschiedliche Farm-Spielstände. Beide bleiben erhalten; automatische Überschreibung ist gestoppt.';
    else if (accountSync === 'error') $('save-note').textContent = 'Lokaler Farm-Spielstand gespeichert. Kontosynchronisierung ist vorübergehend nicht verfügbar.';
    else if (accountSync === 'guest') $('save-note').textContent = 'Farm-Spielstand wird nur auf diesem Gerät gespeichert. Keine Wallet-Verbindung.';
    else $('save-note').textContent = 'Lokaler Farm-Spielstand gespeichert. Kontosynchronisierung wird geprüft.';
    $('farm-conflict-actions').hidden = accountSync !== 'conflict';
  }

  function showConflict(remote) {
    conflictRemote = remote;
    accountSync = 'conflict';
    persist();
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
    const submittedState = JSON.stringify(profile);
    const response = await fetch(PROGRESS_API, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision, state: JSON.parse(submittedState) }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      accountRevision = body.revision || revision + 1;
      saveMeta();
      accountSync = 'account';
      if (JSON.stringify(profile) !== submittedState) syncQueued = true;
      persist();
      return true;
    }
    if (response.status === 409 && body.detail && body.detail.current) {
      if (JSON.stringify(profile) !== submittedState) { syncQueued = true; return false; }
      const current = body.detail.current;
      // Do not automatically retry over a newer revision: even the locally
      // higher-ranked game may be missing edits made on another device.
      if (current.exists && current.state && S.compareProgress(profile, current.state) === 0 && JSON.stringify(profile) !== JSON.stringify(current.state)) {
        showConflict(current);
        return false; // Keep both versions intact instead of silently overwriting either.
      }
      if (current.exists && current.state && JSON.stringify(profile) !== JSON.stringify(current.state)) {
        // A 409 means another device saved while we were editing. A higher
        // progress tuple does not prove that its save includes our changes.
        // Preserve both versions and ask the player before replacing either.
        showConflict(current);
        return false;
      }
      if (!current.exists || !adoptRemote(current)) {
        // A revision conflict without a valid server snapshot must not
        // masquerade as a successful save or silently drop local changes.
        throw new Error('farm-progress-invalid-conflict-state');
      }
      accountSync = 'account';
      persist();
      return false;
    }
    throw new Error('farm-progress-save');
  }

  async function syncAccountProgress() {
    if (!S || accountSync === 'conflict') return;
    if (syncActive) { syncQueued = true; return; }
    syncActive = true; syncQueued = false;
    try {
      const stateAtLoad = JSON.stringify(profile);
      const response = await fetch(PROGRESS_API, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) {
        accountSync = 'guest'; persist(); return;
      }
      if (!response.ok) throw new Error('farm-progress-load');
      const remote = await response.json();
      if (JSON.stringify(profile) !== stateAtLoad) { syncQueued = true; return; }

      if (!remote.exists) {
        await pushFarmState(0);
      } else if (S.chooseNewer(profile, remote.state) === 'remote') {
        // A genuine local save may contain edits absent from the remote state,
        // even when the remote progress counter is higher. Never discard it.
        if (raw && F.decode(raw) && JSON.stringify(profile) !== JSON.stringify(remote.state)) {
          showConflict(remote);
        } else {
          if (!adoptRemote(remote)) throw new Error('farm-progress-invalid-remote');
          accountSync = 'account'; persist();
        }
      } else if (S.compareProgress(profile, remote.state) === 0 && JSON.stringify(profile) !== JSON.stringify(remote.state)) {
        // Equal progress does not prove equal saves; keep both until resolved.
        showConflict(remote);
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

  async function resolveFarmConflict(useLocal) {
    if (conflictBusy || syncActive || accountSync !== 'conflict' || !conflictRemote) return;
    conflictBusy = true;
    $('farm-keep-local').disabled = true;
    $('farm-use-account').disabled = true;
    const localSnapshot = JSON.stringify(profile);
    try {
      const response = await fetch(PROGRESS_API, { credentials: 'include' });
      if (!response.ok) throw new Error('farm-conflict-load');
      const current = await response.json();
      if (!current.exists || !F.decode(JSON.stringify(current.state))) throw new Error('farm-conflict-invalid');
      if (current.revision !== conflictRemote.revision ||
          JSON.stringify(current.state) !== JSON.stringify(conflictRemote.state) ||
          JSON.stringify(profile) !== localSnapshot) {
        showConflict(current);
        $('save-note').textContent = 'Spielstand hat sich geändert. Bitte Auswahl erneut prüfen.';
        return;
      }
      // Keep a recovery snapshot before explicitly replacing either version.
      const backup = useLocal ? current.state : profile;
      localStorage.setItem('bidblitz.farm.conflict-backup.v1', JSON.stringify(backup));
      if (useLocal) {
        const put = await fetch(PROGRESS_API, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: current.revision, state: JSON.parse(localSnapshot) }),
        });
        if (!put.ok) {
          const details = await put.json().catch(() => ({}));
          if (put.status === 409 && details.detail?.current) showConflict(details.detail.current);
          else throw new Error('farm-conflict-save');
          return;
        }
        const saved = await put.json();
        accountRevision = saved.revision;
        saveMeta();
      } else {
        if (!adoptRemote(current)) throw new Error('farm-conflict-adopt');
      }
      conflictRemote = null;
      accountSync = 'account';
      persist();
      render();
      if (JSON.stringify(profile) !== (useLocal ? localSnapshot : JSON.stringify(current.state))) {
        syncAccountProgress();
      }
    } catch {
      $('save-note').textContent = 'Konflikt nicht aufgelöst. Beide Spielstände bleiben unverändert; bitte später erneut versuchen.';
    } finally {
      conflictBusy = false;
      $('farm-keep-local').disabled = false;
      $('farm-use-account').disabled = false;
    }
  }
  $('farm-keep-local').addEventListener('click', () => resolveFarmConflict(true));
  $('farm-use-account').addEventListener('click', () => resolveFarmConflict(false));

  function persistAndSync() {
    persist();
    syncAccountProgress();
  }

  // Reconcile when connectivity returns, including edits made while offline.
  // Account sessions also need a refresh after restoring a cached browser tab.
  function retryAccountSync() {
    // A guest may log in without reloading the farm tab. Recheck the session
    // instead of permanently leaving this game in device-only mode.
    if (navigator.onLine !== false) syncAccountProgress();
  }
  window.addEventListener('online', retryAccountSync);
  window.addEventListener('pageshow', event => {
    if (event.persisted) retryAccountSync();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (accountSync === 'error' || accountSync === 'guest')) retryAccountSync();
  });

  function renderOnboarding() {
    const box = $('onboarding-steps');
    box.replaceChildren();
    F.onboardingSteps(profile).forEach((step, index) => {
      const node = document.createElement('article');
      node.className = 'onboarding-step' + (step.done ? ' done' : '');
      node.innerHTML =
        '<b>' + (index + 1) + '. ' + step.title + '</b>' +
        '<span>' + (step.done ? 'Erledigt' : 'Noch offen') + '</span>';
      box.append(node);
    });
  }

  function renderLevelProgress() {
    const progress = F.nextLevelProgress(profile);
    $('level-progress-current').textContent = progress.level;
    $('level-progress-next').textContent = progress.level >= 50 ? 50 : progress.level + 1;
    $('level-progress-percent').textContent = progress.percent + '%';
    $('level-progress-bar').style.width = progress.percent + '%';

    const completion = F.completionScore(profile);
    $('completion-percent').textContent = completion.percent + '%';
    $('completion-bar').style.width = completion.percent + '%';

    const box = $('level-rewards');
    box.replaceChildren();
    F.levelRewardStatus(profile).forEach(reward => {
      const node = document.createElement('article');
      node.className = 'level-reward' + (reward.unlocked ? ' unlocked' : '') + (reward.claimed ? ' claimed' : '');
      node.innerHTML =
        '<b>Level ' + reward.level + '</b>' +
        '<span>' + reward.title + '</span>' +
        '<span>+' + reward.rewardCoins + ' Münzen · +' + reward.rewardXp + ' XP</span>';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = reward.claimed ? 'Eingelöst' : reward.unlocked ? 'Belohnung' : 'Gesperrt';
      button.disabled = reward.claimed || !reward.unlocked;
      button.addEventListener('click', () => {
        const result = F.claimLevelReward(profile, reward.level);
        if (!result.ok) return;
        profile = result.profile;
        persistAndSync();
        render();
      });
      node.append(button);
      box.append(node);
    });
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
    profile.plots.filter(plot => plot.id <= (profile.unlockedPlots || F.PLOT_COUNT)).forEach(plot => {
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

  function renderAnimals() {
    const box = $('animals');
    box.replaceChildren();
    Object.values(F.ANIMALS).forEach(spec => {
      const herd = profile.animals[spec.id];
      const card = document.createElement('article');
      card.className = 'farm-card';
      const capacity = F.animalCapacity(profile, spec.id);
      const productionBonus = Math.round((F.animalProductBonus(profile, spec.id) - 1) * 100);
      card.innerHTML =
        '<div class="farm-card-head"><div><div class="farm-card-icon">' + spec.icon + '</div><h3>' + spec.name + '</h3></div><strong>' + herd.count + ' / ' + capacity + '</strong></div>' +
        '<p>' + spec.product + ': ' + herd.ready + ' bereit · Produktion ' + herd.progress + ' / ' + spec.produceDays + '</p>' +
        '<p>Gebäudebonus: +' + productionBonus + '% · ' + (herd.fed ? 'Gefüttert für den nächsten Tag.' : 'Futter nötig für Produktion.') + '</p>';

      const actions = document.createElement('div');
      actions.className = 'farm-card-actions';

      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'primary';
      buy.textContent = 'Kaufen · ' + spec.cost;
      buy.disabled = herd.count >= capacity;
      buy.addEventListener('click', () => {
        const result = F.buyAnimal(profile, spec.id);
        if (!result.ok) {
          $('event').textContent = result.reason === 'coins' ? 'Nicht genug virtuelle Farm-Münzen.' : result.reason === 'capacity' ? 'Gebäude zuerst ausbauen.' : 'Tierkauf nicht möglich.';
          return;
        }
        profile = result.profile;
        persistAndSync();
        render();
      });

      const feed = document.createElement('button');
      feed.type = 'button';
      feed.textContent = 'Füttern';
      feed.disabled = herd.count <= 0 || herd.fed;
      feed.addEventListener('click', () => {
        const result = F.feedAnimals(profile, spec.id);
        if (!result.ok) {
          $('event').textContent = result.reason === 'coins' ? 'Nicht genug virtuelle Farm-Münzen für Futter.' : 'Füttern nicht möglich.';
          return;
        }
        profile = result.profile;
        persistAndSync();
        render();
      });

      const collect = document.createElement('button');
      collect.type = 'button';
      collect.textContent = 'Einsammeln';
      collect.disabled = herd.ready <= 0;
      collect.addEventListener('click', () => {
        const result = F.collectAnimalProduct(profile, spec.id);
        if (!result.ok) return;
        profile = result.profile;
        persistAndSync();
        render();
      });

      actions.append(buy, feed, collect);
      card.append(actions);
      box.append(card);
    });
  }

  function renderBuildings() {
    const box = $('buildings');
    box.replaceChildren();
    Object.values(F.BUILDINGS).forEach(spec => {
      const level = profile.buildings[spec.id];
      const cost = F.buildingUpgradeCost(profile, spec.id);
      const card = document.createElement('article');
      card.className = 'farm-card';
      const bonus = spec.id === 'silo' ? 'Erntebonus: +' + ((level - 1) * 5) + '%' : 'Tierkapazität: ' + (level * 3);
      card.innerHTML =
        '<div class="farm-card-head"><div><div class="farm-card-icon">' + spec.icon + '</div><h3>' + spec.name + '</h3></div><strong>Lv. ' + level + '</strong></div>' +
        '<p>' + bonus + '</p>';

      const actions = document.createElement('div');
      actions.className = 'farm-card-actions';
      const upgrade = document.createElement('button');
      upgrade.type = 'button';
      upgrade.className = 'primary';
      upgrade.textContent = cost === null ? 'Maximal' : 'Ausbauen · ' + cost;
      upgrade.disabled = cost === null;
      upgrade.addEventListener('click', () => {
        const result = F.upgradeBuilding(profile, spec.id);
        if (!result.ok) {
          $('event').textContent = result.reason === 'coins' ? 'Nicht genug virtuelle Farm-Münzen.' : 'Gebäude ist bereits maximal ausgebaut.';
          return;
        }
        profile = result.profile;
        persistAndSync();
        render();
      });
      actions.append(upgrade);
      card.append(actions);
      box.append(card);
    });
  }

  function renderAchievements() {
    const box = $('achievements');
    box.replaceChildren();
    F.achievements(profile).forEach(item => {
      const node = document.createElement('article');
      node.className = 'achievement' + (item.achieved ? ' achieved' : '');
      node.innerHTML =
        '<div class="achievement-icon">' + item.icon + '</div>' +
        '<h3>' + item.title + '</h3>' +
        '<p>' + item.text + '</p>' +
        '<span>' + (item.achieved ? 'Erreicht' : 'Offen') + '</span>';
      box.append(node);
    });
  }

  function renderMissions() {
    const box = $('missions');
    box.replaceChildren();
    F.missionStatus(profile).forEach(mission => {
      const node = document.createElement('article');
      node.className = 'mission';
      const progress = Math.round((mission.value / mission.target) * 100);
      node.innerHTML =
        '<div class="mission-top"><span class="mission-title">' + mission.title + '</span><span class="mission-reward">+' + mission.rewardCoins + ' Münzen · +' + mission.rewardXp + ' XP</span></div>' +
        '<div class="mission-progress"><span style="width:' + Math.min(100, progress) + '%"></span></div>';

      const foot = document.createElement('div');
      foot.className = 'mission-foot';
      const text = document.createElement('span');
      text.textContent = mission.value + ' / ' + mission.target + (mission.claimed ? ' · Eingelöst' : '');
      const claim = document.createElement('button');
      claim.type = 'button';
      claim.textContent = mission.claimed ? 'Erledigt' : 'Belohnung';
      claim.disabled = !mission.completed || mission.claimed;
      claim.addEventListener('click', () => {
        const result = F.claimMission(profile, mission.id);
        if (!result.ok) return;
        profile = result.profile;
        persistAndSync();
        render();
      });
      foot.append(text, claim);
      node.append(foot);
      box.append(node);
    });
  }

  function renderOrders() {
    const inventoryBox = $('inventory');
    const ordersBox = $('orders');
    inventoryBox.replaceChildren();
    ordersBox.replaceChildren();

    const rank = F.customerRank(profile);
    $('customer-rank').textContent = rank.name;
    $('order-streak').textContent = profile.orderStreak || 0;
    $('completed-orders').textContent = profile.completedOrders || 0;

    for (const [id, spec] of Object.entries(F.INVENTORY_ITEMS)) {
      const item = document.createElement('div');
      item.className = 'inventory-item';
      item.innerHTML = '<span>' + spec.icon + '</span><b>' + (profile.inventory?.[id] || 0) + '</b>';
      item.title = spec.name;
      inventoryBox.append(item);
    }

    F.orderBoard(profile).forEach(order => {
      const card = document.createElement('article');
      card.className = 'order-card' + (order.fulfilled ? ' done' : '');
      card.innerHTML =
        '<h3>' + order.icon + ' ' + order.quantity + '× ' + order.name + '</h3>' +
        '<p>Bonus: +' + order.rewardCoins + ' Münzen · +' + order.rewardXp + ' XP</p>' +
        '<p>Lager: ' + (profile.inventory?.[order.itemId] || 0) + ' / ' + order.quantity + '</p>';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'primary';
      button.textContent = order.fulfilled ? 'Geliefert' : 'Liefern';
      button.disabled = order.fulfilled || !order.available;
      button.addEventListener('click', () => {
        const result = F.fulfillOrder(profile, order.id);
        if (!result.ok) {
          $('event').textContent = result.reason === 'inventory'
            ? 'Nicht genug Lagerbestand für diese Bestellung.'
            : 'Bestellung kann nicht geliefert werden.';
          return;
        }
        profile = result.profile;
        persistAndSync();
        render();
      });
      card.append(button);
      ordersBox.append(card);
    });
  }

  function renderMarket() {
    const box = $('market');
    box.replaceChildren();
    const snapshot = F.marketSnapshot(profile);
    const labels = {
      wheat: ['🌾', 'Weizen'], corn: ['🌽', 'Mais'], tomato: ['🍅', 'Tomate'], carrot: ['🥕', 'Karotte'],
      chicken: ['🥚', 'Eier'], cow: ['🥛', 'Milch'], sheep: ['🧶', 'Wolle'],
    };
    for (const [id, multiplier] of Object.entries({ ...snapshot.crops, ...snapshot.animals })) {
      const node = document.createElement('div');
      node.className = 'market-item ' + (multiplier >= 1 ? 'up' : 'down');
      const label = labels[id] || ['🧺', id];
      node.innerHTML = '<span>' + label[0] + ' ' + label[1] + '</span><strong>' + Math.round(multiplier * 100) + '%</strong>';
      box.append(node);
    }
  }

  function renderLand() {
    const unlocked = profile.unlockedPlots || F.PLOT_COUNT;
    const cost = F.landExpansionCost(profile);
    $('unlocked-plots').textContent = unlocked;
    $('land-text').textContent = cost === null
      ? 'Maximale Farmfläche freigeschaltet.'
      : 'Nächste Erweiterung: +' + Math.min(3, F.MAX_PLOTS - unlocked) + ' Felder für ' + cost + ' virtuelle Münzen.';
    $('expand-land').disabled = cost === null;
    $('expand-land').textContent = cost === null ? 'Maximal' : 'Erweitern · ' + cost;
  }

  function renderBrief() {
    const event = F.seasonEvent(profile) || F.weatherEvent(profile);
    $('weather-event-icon').textContent = event?.icon || '🌿';
    $('weather-event-title').textContent = event?.title || 'Ruhiger Farmtag';
    $('weather-event-text').textContent = event?.text || 'Gute Bedingungen für Pflege und Planung.';

    const task = F.dailyTask(profile);
    const value = Math.min(task?.target || 1, Math.max(0, task?.value || 0));
    const target = task?.target || 1;
    $('task-title').textContent = task?.title || 'Farm pflegen';
    $('task-progress').style.width = Math.round((value / target) * 100) + '%';
    $('task-text').textContent = value + ' / ' + target;
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
    renderOnboarding();
    renderLevelProgress();
    renderMarket();
    renderOrders();
    renderLand();
    renderBrief();
    renderPlots();
    renderAnimals();
    renderBuildings();
    renderMissions();
    renderAchievements();
  }

  $('expand-land').addEventListener('click', () => {
    const result = F.expandLand(profile);
    if (!result.ok) {
      $('event').textContent = result.reason === 'coins' ? 'Nicht genug virtuelle Farm-Münzen für die Erweiterung.' : 'Farmfläche ist bereits maximal.';
      return;
    }
    profile = result.profile;
    persistAndSync();
    render();
  });

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
    buyAnimal: animalId => {
      const result = F.buyAnimal(profile, animalId);
      if (result.ok) { profile = result.profile; persistAndSync(); render(); }
      return result.ok;
    },
    feedAnimals: animalId => {
      const result = F.feedAnimals(profile, animalId);
      if (result.ok) { profile = result.profile; persistAndSync(); render(); }
      return result.ok;
    },
    collectAnimalProduct: animalId => {
      const result = F.collectAnimalProduct(profile, animalId);
      if (result.ok) { profile = result.profile; persistAndSync(); render(); }
      return result.ok;
    },
    upgradeBuilding: buildingId => {
      const result = F.upgradeBuilding(profile, buildingId);
      if (result.ok) { profile = result.profile; persistAndSync(); render(); }
      return result.ok;
    },
    claimMission: missionId => {
      const result = F.claimMission(profile, missionId);
      if (result.ok) { profile = result.profile; persistAndSync(); render(); }
      return result.ok;
    },
    expandLand: () => {
      const result = F.expandLand(profile);
      if (result.ok) { profile = result.profile; persistAndSync(); render(); }
      return result.ok;
    },
    market: () => F.marketSnapshot(profile),
    orders: () => F.orderBoard(profile),
    fulfillOrder: orderId => {
      const result = F.fulfillOrder(profile, orderId);
      if (result.ok) { profile = result.profile; persistAndSync(); render(); }
      return result.ok;
    },
    claimLevelReward: level => {
      const result = F.claimLevelReward(profile, level);
      if (result.ok) { profile = result.profile; persistAndSync(); render(); }
      return result.ok;
    },
    achievements: () => F.achievements(profile),
  };
}());

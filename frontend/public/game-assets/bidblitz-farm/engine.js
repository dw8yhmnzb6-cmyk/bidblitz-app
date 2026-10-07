(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BidBlitzFarm = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const VERSION = 1;
  const PLOT_COUNT = 6;
  const MAX_PLOTS = 12;
  const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const WEATHER = ['sunny', 'cloudy', 'rain', 'storm'];
  const CROPS = {
    wheat:  { id: 'wheat',  name: 'Wheat',  seedCost: 4,  growDays: 2, sell: 12, xp: 4, preferred: ['Spring','Autumn'] },
    corn:   { id: 'corn',   name: 'Corn',   seedCost: 7,  growDays: 3, sell: 22, xp: 7, preferred: ['Summer'] },
    tomato: { id: 'tomato', name: 'Tomato', seedCost: 10, growDays: 4, sell: 34, xp: 10, preferred: ['Spring','Summer'] },
    carrot: { id: 'carrot', name: 'Carrot', seedCost: 6,  growDays: 3, sell: 18, xp: 6, preferred: ['Spring','Autumn','Winter'] },
  };
  const ANIMALS = {
    chicken: { id: 'chicken', name: 'Huhn', icon: '🐔', cost: 30, feedCost: 3, produceDays: 1, product: 'Eier', productValue: 7, xp: 3, building: 'coop' },
    cow: { id: 'cow', name: 'Kuh', icon: '🐄', cost: 90, feedCost: 8, produceDays: 2, product: 'Milch', productValue: 24, xp: 7, building: 'barn' },
    sheep: { id: 'sheep', name: 'Schaf', icon: '🐑', cost: 65, feedCost: 6, produceDays: 2, product: 'Wolle', productValue: 18, xp: 5, building: 'barn' },
  };
  const BUILDINGS = {
    coop: { id: 'coop', name: 'Hühnerstall', icon: '🏠', baseCost: 70, maxLevel: 5 },
    barn: { id: 'barn', name: 'Scheune', icon: '🏚️', baseCost: 100, maxLevel: 5 },
    silo: { id: 'silo', name: 'Silo', icon: '🌾', baseCost: 80, maxLevel: 5 },
  };
  const MISSIONS = [
    { id: 'harvest-5', title: 'Ernte 5 Pflanzen', kind: 'harvests', target: 5, rewardCoins: 30, rewardXp: 15 },
    { id: 'animals-3', title: 'Halte 3 Tiere', kind: 'animals', target: 3, rewardCoins: 45, rewardXp: 20 },
    { id: 'buildings-5', title: 'Erreiche 5 Gebäude-Level', kind: 'buildings', target: 5, rewardCoins: 60, rewardXp: 25 },
    { id: 'farm-level-5', title: 'Erreiche Farm-Level 5', kind: 'level', target: 5, rewardCoins: 80, rewardXp: 30 },
  ];
  const INVENTORY_ITEMS = {
    wheat: { id: 'wheat', name: 'Weizen', icon: '🌾', baseValue: 12 },
    corn: { id: 'corn', name: 'Mais', icon: '🌽', baseValue: 22 },
    tomato: { id: 'tomato', name: 'Tomate', icon: '🍅', baseValue: 34 },
    carrot: { id: 'carrot', name: 'Karotte', icon: '🥕', baseValue: 18 },
    eggs: { id: 'eggs', name: 'Eier', icon: '🥚', baseValue: 7 },
    milk: { id: 'milk', name: 'Milch', icon: '🥛', baseValue: 24 },
    wool: { id: 'wool', name: 'Wolle', icon: '🧶', baseValue: 18 },
  };

  const clone = value => JSON.parse(JSON.stringify(value));

  function xorshift(value) {
    let x = value >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return x >>> 0 || 2463534242;
  }

  function weatherFor(seed, day, season) {
    let rng = (seed ^ (day * 2654435761) ^ (season * 2246822519)) >>> 0;
    rng = xorshift(rng);
    const roll = rng / 4294967296;
    const seasonName = SEASONS[season];
    if (seasonName === 'Summer') return roll < .48 ? 'sunny' : roll < .70 ? 'cloudy' : roll < .92 ? 'rain' : 'storm';
    if (seasonName === 'Winter') return roll < .20 ? 'sunny' : roll < .55 ? 'cloudy' : roll < .88 ? 'rain' : 'storm';
    return roll < .30 ? 'sunny' : roll < .52 ? 'cloudy' : roll < .90 ? 'rain' : 'storm';
  }

  function seasonForDay(day) {
    return Math.floor((day - 1) / 7) % SEASONS.length;
  }

  function emptyPlot(id) {
    return { id, crop: null, plantedDay: null, growth: 0, watered: false, health: 100, ready: false };
  }

  function levelFromXp(xp) {
    return Math.min(50, 1 + Math.floor(Math.max(0, xp) / 40));
  }

  function initial(seed = 123456) {
    seed = Number.isInteger(seed) && seed > 0 ? seed >>> 0 : 123456;
    return {
      version: VERSION,
      seed,
      day: 1,
      season: 0,
      weather: weatherFor(seed, 1, 0),
      coins: 60,
      xp: 0,
      level: 1,
      harvests: 0,
      unlockedPlots: PLOT_COUNT,
      animals: {
        chicken: { count: 0, fed: false, progress: 0, ready: 0 },
        cow: { count: 0, fed: false, progress: 0, ready: 0 },
        sheep: { count: 0, fed: false, progress: 0, ready: 0 },
      },
      buildings: { coop: 1, barn: 1, silo: 1 },
      inventory: Object.fromEntries(Object.keys(INVENTORY_ITEMS).map(id => [id, 0])),
      fulfilledOrders: [],
      completedOrders: 0,
      orderStreak: 0,
      lastOrderStreakDay: 0,
      claimedMissions: [],
      plots: Array.from({ length: MAX_PLOTS }, (_, index) => emptyPlot(index + 1)),
      lastEvent: 'Farm gestartet.',
    };
  }

  function plant(profile, plotId, cropId) {
    if (!profile || !CROPS[cropId]) return { ok: false, profile, reason: 'crop' };
    const index = profile.plots.findIndex(plot => plot.id === plotId);
    if (index < 0 || plotId > (profile.unlockedPlots || PLOT_COUNT) || profile.plots[index].crop) return { ok: false, profile, reason: 'plot' };
    const crop = CROPS[cropId];
    const event = seasonEvent(profile);
    const seedCost = Math.max(1, Math.ceil(crop.seedCost * (1 - (event?.seedDiscount || 0))));
    if (profile.coins < seedCost) return { ok: false, profile, reason: 'coins' };
    const next = clone(profile);
    next.coins -= seedCost;
    next.plots[index] = {
      id: plotId, crop: cropId, plantedDay: next.day, growth: 0,
      watered: false, health: 100, ready: false,
    };
    next.lastEvent = crop.name + ' gepflanzt.';
    return { ok: true, profile: next };
  }

  function water(profile, plotId) {
    const index = profile?.plots?.findIndex(plot => plot.id === plotId) ?? -1;
    if (index < 0 || plotId > (profile.unlockedPlots || PLOT_COUNT) || !profile.plots[index].crop || profile.plots[index].ready) return { ok: false, profile };
    const next = clone(profile);
    next.plots[index].watered = true;
    next.lastEvent = 'Feld ' + plotId + ' bewässert.';
    return { ok: true, profile: next };
  }

  function dayGrowth(plot, weather, seasonName) {
    const crop = CROPS[plot.crop];
    let gain = 1;
    const naturallyWet = weather === 'rain' || weather === 'storm';
    if (!plot.watered && !naturallyWet) gain -= .55;
    if (weather === 'storm') gain -= .20;
    if (crop.preferred.includes(seasonName)) gain += .15;
    if (seasonName === 'Winter' && !crop.preferred.includes('Winter')) gain -= .20;
    return Math.max(0, gain);
  }

  function advanceDay(profile) {
    if (!profile) return { ok: false, profile };
    const next = clone(profile);
    const currentSeason = SEASONS[next.season];

    next.plots = next.plots.map(plot => {
      if (!plot.crop || plot.ready) return { ...plot, watered: false };
      const wet = plot.watered || next.weather === 'rain' || next.weather === 'storm';
      const growthGain = dayGrowth(plot, next.weather, currentSeason);
      const updated = { ...plot, growth: Math.max(0, plot.growth + growthGain), watered: false };
      if (!wet && next.weather === 'sunny') updated.health = Math.max(0, updated.health - 15);
      else if (next.weather === 'storm') updated.health = Math.max(0, updated.health - 8);
      else updated.health = Math.min(100, updated.health + 4);

      const seasonal = seasonEvent(next);
      if (seasonal?.id === 'summer-heat' && !wet) updated.health = Math.max(0, updated.health - seasonal.healthPenalty);
      if (seasonal?.id === 'winter-frost' && !CROPS[updated.crop].preferred.includes('Winter')) {
        updated.health = Math.max(0, updated.health - seasonal.healthPenalty);
      }
      const crop = CROPS[updated.crop];
      updated.ready = updated.health > 0 && updated.growth >= crop.growDays;
      return updated;
    });

    for (const [animalId, herd] of Object.entries(next.animals || {})) {
      const spec = ANIMALS[animalId];
      if (!spec || herd.count <= 0) continue;
      if (herd.fed) {
        herd.progress += 1;
        if (herd.progress >= spec.produceDays) {
          herd.ready += herd.count;
          herd.progress = 0;
        }
      }
      herd.fed = false;
    }

    next.day += 1;
    next.season = seasonForDay(next.day);
    next.weather = weatherFor(next.seed, next.day, next.season);
    next.level = levelFromXp(next.xp);
    next.lastEvent = 'Tag ' + next.day + ': ' + next.weather + '.';
    return { ok: true, profile: next };
  }

  function harvest(profile, plotId) {
    const index = profile?.plots?.findIndex(plot => plot.id === plotId) ?? -1;
    if (index < 0 || plotId > (profile.unlockedPlots || PLOT_COUNT) || !profile.plots[index].crop || !profile.plots[index].ready) return { ok: false, profile };
    const next = clone(profile);
    const plot = next.plots[index];
    const crop = CROPS[plot.crop];
    const healthMultiplier = Math.max(.5, plot.health / 100);
    const seasonBonus = crop.preferred.includes(SEASONS[next.season]) ? 1.1 : 1;
    const siloBonus = 1 + Math.max(0, (next.buildings?.silo || 1) - 1) * 0.05;
    const marketBonus = marketMultiplier(next, crop.id);
    const eventBonus = 1 + (seasonEvent(next)?.harvestBonus || 0);
    const revenue = Math.max(1, Math.floor(crop.sell * healthMultiplier * seasonBonus * siloBonus * marketBonus * eventBonus));
    next.coins += revenue;
    next.inventory[crop.id] = (next.inventory[crop.id] || 0) + 1;
    next.xp += crop.xp;
    next.level = levelFromXp(next.xp);
    next.harvests += 1;
    next.plots[index] = emptyPlot(plotId);
    next.lastEvent = crop.name + ' geerntet: +' + revenue + ' Münzen.';
    return { ok: true, profile: next, revenue };
  }

  function dailyTask(profile) {
    if (!profile) return null;
    const cycle = (profile.day - 1) % 4;
    if (cycle === 0) {
      return { id: 'plant', title: 'Pflanze 2 Felder', target: 2, value: profile.plots.filter(plot => plot.crop).length };
    }
    if (cycle === 1) {
      return { id: 'water', title: 'Bewässere 3 Felder', target: 3, value: profile.plots.filter(plot => plot.watered).length };
    }
    if (cycle === 2) {
      return { id: 'harvest', title: 'Erreiche 3 Ernten', target: 3, value: Math.min(3, profile.harvests) };
    }
    return { id: 'xp', title: 'Sammle 40 Farm-XP', target: 40, value: profile.xp % 40 };
  }

  function seasonEvent(profile) {
    if (!profile) return null;
    const cycleDay = ((profile.day - 1) % 28) + 1;
    if (cycleDay === 7) return { id: 'spring-fair', icon: '🌱', title: 'Frühlings-Saatfest', text: 'Saatgut kostet heute 20% weniger.', seedDiscount: 0.20, harvestBonus: 0, healthPenalty: 0 };
    if (cycleDay === 14) return { id: 'summer-heat', icon: '🌞', title: 'Sommer-Hitzewoche', text: 'Unbewässerte Felder verlieren heute zusätzliche Gesundheit.', seedDiscount: 0, harvestBonus: 0, healthPenalty: 8 };
    if (cycleDay === 21) return { id: 'autumn-festival', icon: '🍂', title: 'Herbst-Erntefest', text: 'Ernten bringen heute 20% mehr virtuelle Farm-Münzen.', seedDiscount: 0, harvestBonus: 0.20, healthPenalty: 0 };
    if (cycleDay === 28) return { id: 'winter-frost', icon: '❄️', title: 'Winter-Frosttag', text: 'Nicht winterfeste Pflanzen verlieren zusätzliche Gesundheit.', seedDiscount: 0, harvestBonus: 0, healthPenalty: 12 };
    return null;
  }

  function weatherEvent(profile) {
    if (!profile) return null;
    let rng = (profile.seed ^ ((profile.day * 3266489917) >>> 0) ^ 0x9e3779b9) >>> 0;
    rng = xorshift(rng);
    const roll = rng / 4294967296;
    if (profile.weather === 'storm' && roll < .55) return { type: 'storm', icon: '🌪️', title: 'Sturmwarnung', text: 'Empfindliche Pflanzen verlieren bei Gewitter etwas Gesundheit.' };
    if (profile.weather === 'rain' && roll < .45) return { type: 'rain', icon: '💧', title: 'Natürliche Bewässerung', text: 'Regen versorgt deine Felder automatisch mit Wasser.' };
    if (profile.weather === 'sunny' && roll < .35) return { type: 'heat', icon: '🔥', title: 'Heißer Tag', text: 'Unbewässerte Felder wachsen heute langsamer.' };
    if (roll < .18) return { type: 'market', icon: '🧺', title: 'Markttag', text: 'Plane deine nächste Ernte für gute virtuelle Verkaufserlöse.' };
    return { type: 'calm', icon: '🌿', title: 'Ruhiger Farmtag', text: 'Gute Bedingungen für Pflege und Planung.' };
  }

  function buildingUpgradeCost(profile, buildingId) {
    const spec = BUILDINGS[buildingId];
    const level = profile?.buildings?.[buildingId];
    if (!spec || !Number.isInteger(level) || level < 1 || level >= spec.maxLevel) return null;
    return spec.baseCost * level;
  }

  function animalCapacity(profile, animalId) {
    const spec = ANIMALS[animalId];
    if (!spec) return 0;
    return Math.max(0, (profile?.buildings?.[spec.building] || 1) * 3);
  }

  function animalProductBonus(profile, animalId) {
    const spec = ANIMALS[animalId];
    if (!spec) return 1;
    const level = profile?.buildings?.[spec.building] || 1;
    return 1 + Math.max(0, level - 1) * 0.05;
  }

  function buyAnimal(profile, animalId) {
    const spec = ANIMALS[animalId];
    if (!profile || !spec) return { ok: false, profile, reason: 'animal' };
    const herd = profile.animals?.[animalId];
    if (!herd || herd.count >= animalCapacity(profile, animalId)) return { ok: false, profile, reason: 'capacity' };
    if (profile.coins < spec.cost) return { ok: false, profile, reason: 'coins' };
    const next = clone(profile);
    next.coins -= spec.cost;
    next.animals[animalId].count += 1;
    next.lastEvent = spec.name + ' gekauft.';
    return { ok: true, profile: next };
  }

  function feedAnimals(profile, animalId) {
    const spec = ANIMALS[animalId];
    const herd = profile?.animals?.[animalId];
    if (!profile || !spec || !herd || herd.count <= 0 || herd.fed) return { ok: false, profile, reason: 'animal' };
    const cost = spec.feedCost * herd.count;
    if (profile.coins < cost) return { ok: false, profile, reason: 'coins' };
    const next = clone(profile);
    next.coins -= cost;
    next.animals[animalId].fed = true;
    next.lastEvent = spec.name + ': Futter für ' + herd.count + ' Tier(e).';
    return { ok: true, profile: next, cost };
  }

  function collectAnimalProduct(profile, animalId) {
    const spec = ANIMALS[animalId];
    const herd = profile?.animals?.[animalId];
    if (!profile || !spec || !herd || herd.ready <= 0) return { ok: false, profile };
    const next = clone(profile);
    const quantity = next.animals[animalId].ready;
    const revenue = Math.max(1, Math.floor(quantity * spec.productValue * marketMultiplier(next, animalId) * animalProductBonus(next, animalId)));
    next.animals[animalId].ready = 0;
    const productId = animalId === 'chicken' ? 'eggs' : animalId === 'cow' ? 'milk' : 'wool';
    next.inventory[productId] = (next.inventory[productId] || 0) + quantity;
    next.coins += revenue;
    next.xp += quantity * spec.xp;
    next.level = levelFromXp(next.xp);
    next.lastEvent = quantity + '× ' + spec.product + ' eingesammelt: +' + revenue + ' Münzen.';
    return { ok: true, profile: next, quantity, revenue };
  }

  function upgradeBuilding(profile, buildingId) {
    const spec = BUILDINGS[buildingId];
    const cost = buildingUpgradeCost(profile, buildingId);
    if (!profile || !spec || cost === null) return { ok: false, profile, reason: 'max' };
    if (profile.coins < cost) return { ok: false, profile, reason: 'coins' };
    const next = clone(profile);
    next.coins -= cost;
    next.buildings[buildingId] += 1;
    next.xp += 10 * next.buildings[buildingId];
    next.level = levelFromXp(next.xp);
    next.lastEvent = spec.name + ' auf Level ' + next.buildings[buildingId] + ' ausgebaut.';
    return { ok: true, profile: next, cost };
  }

  function missionValue(profile, mission) {
    if (mission.kind === 'harvests') return profile.harvests;
    if (mission.kind === 'animals') return Object.values(profile.animals || {}).reduce((sum, herd) => sum + (herd.count || 0), 0);
    if (mission.kind === 'buildings') return Object.values(profile.buildings || {}).reduce((sum, level) => sum + (level || 0), 0);
    if (mission.kind === 'level') return profile.level;
    return 0;
  }

  function missionStatus(profile) {
    return MISSIONS.map(mission => ({
      ...mission,
      value: Math.min(mission.target, missionValue(profile, mission)),
      completed: missionValue(profile, mission) >= mission.target,
      claimed: (profile.claimedMissions || []).includes(mission.id),
    }));
  }

  function claimMission(profile, missionId) {
    const mission = MISSIONS.find(item => item.id === missionId);
    if (!profile || !mission || (profile.claimedMissions || []).includes(missionId)) return { ok: false, profile };
    const value = missionValue(profile, mission);
    if (value < mission.target) return { ok: false, profile };
    const next = clone(profile);
    next.claimedMissions.push(mission.id);
    next.coins += mission.rewardCoins;
    next.xp += mission.rewardXp;
    next.level = levelFromXp(next.xp);
    next.lastEvent = 'Mission abgeschlossen: ' + mission.title + '.';
    return { ok: true, profile: next };
  }

  function marketMultiplier(profile, itemId) {
    if (!profile) return 1;
    let hash = 0;
    for (let i = 0; i < String(itemId).length; i++) hash = ((hash * 31) + String(itemId).charCodeAt(i)) >>> 0;
    let rng = (profile.seed ^ ((profile.day * 1597334677) >>> 0) ^ hash) >>> 0;
    rng = xorshift(rng);
    return 0.85 + (rng / 4294967296) * 0.45;
  }

  function marketSnapshot(profile) {
    const crops = Object.fromEntries(Object.keys(CROPS).map(id => [id, Number(marketMultiplier(profile, id).toFixed(2))]));
    const animals = Object.fromEntries(Object.keys(ANIMALS).map(id => [id, Number(marketMultiplier(profile, id).toFixed(2))]));
    return { day: profile.day, crops, animals };
  }

  function landExpansionCost(profile) {
    const unlocked = profile?.unlockedPlots || PLOT_COUNT;
    if (unlocked >= MAX_PLOTS) return null;
    return unlocked === 6 ? 180 : 360;
  }

  function expandLand(profile) {
    if (!profile) return { ok: false, profile, reason: 'farm' };
    const cost = landExpansionCost(profile);
    if (cost === null) return { ok: false, profile, reason: 'max' };
    if (profile.coins < cost) return { ok: false, profile, reason: 'coins' };
    const next = clone(profile);
    next.coins -= cost;
    next.unlockedPlots = Math.min(MAX_PLOTS, (next.unlockedPlots || PLOT_COUNT) + 3);
    next.xp += 20;
    next.level = levelFromXp(next.xp);
    next.lastEvent = 'Farmfläche auf ' + next.unlockedPlots + ' Felder erweitert.';
    return { ok: true, profile: next, cost };
  }

  function orderBoard(profile) {
    if (!profile) return [];
    const ids = Object.keys(INVENTORY_ITEMS);
    return Array.from({ length: 3 }, (_, index) => {
      let rng = (profile.seed ^ ((profile.day * 1103515245) >>> 0) ^ ((index + 1) * 2654435761)) >>> 0;
      rng = xorshift(rng);
      const itemId = ids[rng % ids.length];
      rng = xorshift(rng);
      const quantity = 1 + (rng % 3);
      const item = INVENTORY_ITEMS[itemId];
      const rewardCoins = Math.max(5, Math.floor(item.baseValue * quantity * 1.35));
      const rewardXp = 3 + quantity * 2;
      const id = 'order-' + profile.day + '-' + index;
      return {
        id, itemId, name: item.name, icon: item.icon, quantity,
        rewardCoins, rewardXp,
        fulfilled: (profile.fulfilledOrders || []).includes(id),
        available: (profile.inventory?.[itemId] || 0) >= quantity,
      };
    });
  }

  function customerRank(profile) {
    const completed = Math.max(0, Number(profile?.completedOrders) || 0);
    if (completed >= 60) return { id: 'legend', name: 'Markt-Legende', level: 5 };
    if (completed >= 30) return { id: 'expert', name: 'Liefer-Experte', level: 4 };
    if (completed >= 15) return { id: 'trusted', name: 'Stamm-Lieferant', level: 3 };
    if (completed >= 6) return { id: 'known', name: 'Bekannter Hof', level: 2 };
    return { id: 'new', name: 'Neuer Lieferant', level: 1 };
  }

  function dailyOrderCompletion(profile, day = profile?.day) {
    if (!profile || !Number.isInteger(day)) return 0;
    const prefix = 'order-' + day + '-';
    return (profile.fulfilledOrders || []).filter(id => id.startsWith(prefix)).length;
  }

  function fulfillOrder(profile, orderId) {
    if (!profile || typeof orderId !== 'string') return { ok: false, profile, reason: 'order' };
    const order = orderBoard(profile).find(item => item.id === orderId);
    if (!order || order.fulfilled) return { ok: false, profile, reason: 'order' };
    if ((profile.inventory?.[order.itemId] || 0) < order.quantity) return { ok: false, profile, reason: 'inventory' };
    const next = clone(profile);
    next.inventory[order.itemId] -= order.quantity;
    next.coins += order.rewardCoins;
    next.xp += order.rewardXp;
    next.level = levelFromXp(next.xp);
    next.completedOrders = (next.completedOrders || 0) + 1;
    next.fulfilledOrders = [...(next.fulfilledOrders || []), order.id].slice(-90);

    const completedToday = dailyOrderCompletion(next, next.day);
    let streakBonusCoins = 0;
    let streakBonusXp = 0;
    if (completedToday >= 3) {
      next.orderStreak = next.lastOrderStreakDay === next.day - 1
        ? Math.min(30, (next.orderStreak || 0) + 1)
        : 1;
      next.lastOrderStreakDay = next.day;
      streakBonusCoins = 10 + next.orderStreak * 5;
      streakBonusXp = 5 + next.orderStreak * 2;
      next.coins += streakBonusCoins;
      next.xp += streakBonusXp;
      next.level = levelFromXp(next.xp);
    }

    next.lastEvent = 'Bestellung geliefert: ' + order.quantity + '× ' + order.name +
      (streakBonusCoins ? ' · Serienbonus +' + streakBonusCoins + ' Münzen.' : '.');
    return { ok: true, profile: next, order, streakBonusCoins, streakBonusXp };
  }

  function forecast(profile, days = 7) {
    if (!profile || !Number.isInteger(days) || days < 1 || days > 14) return [];
    return Array.from({ length: days }, (_, index) => {
      const day = profile.day + index;
      const season = seasonForDay(day);
      return { day, season: SEASONS[season], weather: weatherFor(profile.seed, day, season) };
    });
  }

  function decode(text) {
    try {
      const value = JSON.parse(text);
      const int = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
      if (!value || value.version !== VERSION || !int(value.seed, 1, 4294967295)) return null;
      if (!int(value.day, 1, 100000) || !int(value.season, 0, 3) || !WEATHER.includes(value.weather)) return null;
      if (!int(value.coins, 0, 1e9) || !int(value.xp, 0, 1e9) || !int(value.level, 1, 50) || !int(value.harvests, 0, 1e9)) return null;
      if (!value.animals) value.animals = initial(value.seed).animals;
      if (!value.buildings) value.buildings = { coop: 1, barn: 1, silo: 1 };
      if (!value.inventory) value.inventory = Object.fromEntries(Object.keys(INVENTORY_ITEMS).map(id => [id, 0]));
      if (!Array.isArray(value.fulfilledOrders)) value.fulfilledOrders = [];
      if (!Number.isInteger(value.completedOrders)) value.completedOrders = 0;
      if (!Number.isInteger(value.orderStreak)) value.orderStreak = 0;
      if (!Number.isInteger(value.lastOrderStreakDay)) value.lastOrderStreakDay = 0;
      if (!Array.isArray(value.claimedMissions)) value.claimedMissions = [];
      for (const [animalId, spec] of Object.entries(ANIMALS)) {
        const herd = value.animals[animalId];
        if (!herd || !int(herd.count, 0, 100) || typeof herd.fed !== 'boolean' || !int(herd.progress, 0, spec.produceDays) || !int(herd.ready, 0, 100000)) return null;
        if (herd.count > animalCapacity(value, animalId)) return null;
      }
      for (const [buildingId, spec] of Object.entries(BUILDINGS)) {
        if (!int(value.buildings[buildingId], 1, spec.maxLevel)) return null;
      }
      for (const id of Object.keys(INVENTORY_ITEMS)) {
        if (!int(value.inventory[id], 0, 1000000)) return null;
      }
      if (!int(value.completedOrders, 0, 1000000)) return null;
      if (!int(value.orderStreak, 0, 30)) return null;
      if (!int(value.lastOrderStreakDay, 0, value.day)) return null;
      if (value.fulfilledOrders.length > 90 || !value.fulfilledOrders.every(id => /^order-\d{1,6}-[0-2]$/.test(id))) return null;
      if (!value.claimedMissions.every(id => MISSIONS.some(mission => mission.id === id))) return null;
      if (!Number.isInteger(value.unlockedPlots)) value.unlockedPlots = PLOT_COUNT;
      if (![6, 9, 12].includes(value.unlockedPlots)) return null;
      if (!Array.isArray(value.plots) || ![PLOT_COUNT, MAX_PLOTS].includes(value.plots.length)) return null;
      if (value.plots.length === PLOT_COUNT) {
        value.plots = value.plots.concat(Array.from({ length: MAX_PLOTS - PLOT_COUNT }, (_, index) => emptyPlot(PLOT_COUNT + index + 1)));
      }
      for (let i = 0; i < MAX_PLOTS; i++) {
        const plot = value.plots[i];
        if (!plot || plot.id !== i + 1 || !int(plot.health, 0, 100) || typeof plot.watered !== 'boolean' || typeof plot.ready !== 'boolean') return null;
        if (plot.crop === null) {
          if (plot.plantedDay !== null || plot.growth !== 0 || plot.ready) return null;
        } else {
          if (!CROPS[plot.crop] || !int(plot.plantedDay, 1, value.day)) return null;
          if (typeof plot.growth !== 'number' || !Number.isFinite(plot.growth) || plot.growth < 0 || plot.growth > 1000) return null;
        }
      }
      if (value.season !== seasonForDay(value.day)) return null;
      if (value.weather !== weatherFor(value.seed, value.day, value.season)) return null;
      if (value.level !== levelFromXp(value.xp)) return null;
      return value;
    } catch {
      return null;
    }
  }

  return {
    VERSION, PLOT_COUNT, MAX_PLOTS, SEASONS, WEATHER, CROPS, ANIMALS, BUILDINGS, MISSIONS, INVENTORY_ITEMS,
    initial, plant, water, advanceDay, harvest, forecast,
    weatherFor, seasonForDay, levelFromXp, dailyTask, seasonEvent, weatherEvent,
    buildingUpgradeCost, animalCapacity, animalProductBonus, buyAnimal, feedAnimals, collectAnimalProduct,
    upgradeBuilding, missionStatus, claimMission, marketMultiplier, marketSnapshot, landExpansionCost, expandLand, customerRank, dailyOrderCompletion, orderBoard, fulfillOrder, decode,
  };
}));

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BidBlitzFarm = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const VERSION = 1;
  const PLOT_COUNT = 6;
  const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const WEATHER = ['sunny', 'cloudy', 'rain', 'storm'];
  const CROPS = {
    wheat:  { id: 'wheat',  name: 'Wheat',  seedCost: 4,  growDays: 2, sell: 12, xp: 4, preferred: ['Spring','Autumn'] },
    corn:   { id: 'corn',   name: 'Corn',   seedCost: 7,  growDays: 3, sell: 22, xp: 7, preferred: ['Summer'] },
    tomato: { id: 'tomato', name: 'Tomato', seedCost: 10, growDays: 4, sell: 34, xp: 10, preferred: ['Spring','Summer'] },
    carrot: { id: 'carrot', name: 'Carrot', seedCost: 6,  growDays: 3, sell: 18, xp: 6, preferred: ['Spring','Autumn','Winter'] },
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
      plots: Array.from({ length: PLOT_COUNT }, (_, index) => emptyPlot(index + 1)),
      lastEvent: 'Farm gestartet.',
    };
  }

  function plant(profile, plotId, cropId) {
    if (!profile || !CROPS[cropId]) return { ok: false, profile, reason: 'crop' };
    const index = profile.plots.findIndex(plot => plot.id === plotId);
    if (index < 0 || profile.plots[index].crop) return { ok: false, profile, reason: 'plot' };
    const crop = CROPS[cropId];
    if (profile.coins < crop.seedCost) return { ok: false, profile, reason: 'coins' };
    const next = clone(profile);
    next.coins -= crop.seedCost;
    next.plots[index] = {
      id: plotId, crop: cropId, plantedDay: next.day, growth: 0,
      watered: false, health: 100, ready: false,
    };
    next.lastEvent = crop.name + ' gepflanzt.';
    return { ok: true, profile: next };
  }

  function water(profile, plotId) {
    const index = profile?.plots?.findIndex(plot => plot.id === plotId) ?? -1;
    if (index < 0 || !profile.plots[index].crop || profile.plots[index].ready) return { ok: false, profile };
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
      const crop = CROPS[updated.crop];
      updated.ready = updated.health > 0 && updated.growth >= crop.growDays;
      return updated;
    });

    next.day += 1;
    next.season = seasonForDay(next.day);
    next.weather = weatherFor(next.seed, next.day, next.season);
    next.level = levelFromXp(next.xp);
    next.lastEvent = 'Tag ' + next.day + ': ' + next.weather + '.';
    return { ok: true, profile: next };
  }

  function harvest(profile, plotId) {
    const index = profile?.plots?.findIndex(plot => plot.id === plotId) ?? -1;
    if (index < 0 || !profile.plots[index].crop || !profile.plots[index].ready) return { ok: false, profile };
    const next = clone(profile);
    const plot = next.plots[index];
    const crop = CROPS[plot.crop];
    const healthMultiplier = Math.max(.5, plot.health / 100);
    const seasonBonus = crop.preferred.includes(SEASONS[next.season]) ? 1.1 : 1;
    const revenue = Math.max(1, Math.floor(crop.sell * healthMultiplier * seasonBonus));
    next.coins += revenue;
    next.xp += crop.xp;
    next.level = levelFromXp(next.xp);
    next.harvests += 1;
    next.plots[index] = emptyPlot(plotId);
    next.lastEvent = crop.name + ' geerntet: +' + revenue + ' Münzen.';
    return { ok: true, profile: next, revenue };
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
      if (!Array.isArray(value.plots) || value.plots.length !== PLOT_COUNT) return null;
      for (let i = 0; i < PLOT_COUNT; i++) {
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
    VERSION, PLOT_COUNT, SEASONS, WEATHER, CROPS,
    initial, plant, water, advanceDay, harvest, forecast,
    weatherFor, seasonForDay, levelFromXp, decode,
  };
}));

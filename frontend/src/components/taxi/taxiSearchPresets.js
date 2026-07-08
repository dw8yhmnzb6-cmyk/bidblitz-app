const PRESET_PLACES = [
  {
    id: 'preset-prishtina-city',
    name: 'Prishtina',
    address: 'Prishtina, Kosovo',
    lat: 42.6629,
    lng: 21.1655,
    type: 'place',
    aliases: ['pri', 'pris', 'prist', 'pristi', 'pristina', 'prisht', 'prishti', 'prishtina'],
  },
  {
    id: 'preset-prishtina-airport',
    name: 'Flughafen Prishtina',
    address: 'Prishtina International Airport Adem Jashari, Kosovo',
    lat: 42.5728,
    lng: 21.0358,
    type: 'airport',
    aliases: ['prn', 'airport', 'airport prishtina', 'airport pristina', 'adem', 'adem jashari', 'flug', 'flughafen', 'flughafen pri'],
  },
  {
    id: 'preset-prizren',
    name: 'Prizren',
    address: 'Prizren, Kosovo',
    lat: 42.2139,
    lng: 20.7397,
    type: 'place',
    aliases: ['pri', 'priz', 'prizr', 'prizren'],
  },
  {
    id: 'preset-peja',
    name: 'Peja',
    address: 'Peja, Kosovo',
    lat: 42.6591,
    lng: 20.2883,
    type: 'place',
    aliases: ['pej', 'peja'],
  },
  {
    id: 'preset-gjilan',
    name: 'Gjilan',
    address: 'Gjilan, Kosovo',
    lat: 42.4637,
    lng: 21.4694,
    type: 'place',
    aliases: ['gji', 'gjil', 'gjilan'],
  },
  {
    id: 'preset-ferizaj',
    name: 'Ferizaj',
    address: 'Ferizaj, Kosovo',
    lat: 42.3702,
    lng: 21.1553,
    type: 'place',
    aliases: ['fer', 'feri', 'feriz', 'ferizaj'],
  },
];

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function scorePreset(place, query) {
  const q = normalize(query);
  const hay = `${place.name} ${place.address} ${(place.aliases || []).join(' ')}`;
  const hayNorm = normalize(hay);
  let score = 0;
  const exactAlias = (place.aliases || []).some((alias) => normalize(alias) === q);
  const startsAlias = (place.aliases || []).some((alias) => normalize(alias).startsWith(q));
  const nameStarts = normalize(place.name).startsWith(q);

  if (q === 'pri' && place.name === 'Prishtina') score += 220;
  if (q === 'pri' && place.name === 'Flughafen Prishtina') score += 170;
  if (q === 'pri' && place.name === 'Prizren') score += 120;

  if (q === 'pris' && place.name === 'Prishtina') score += 240;
  if (q === 'prish' && place.name === 'Prishtina') score += 260;
  if (q.startsWith('prisht') && place.name === 'Prishtina') score += 320;

  if (exactAlias) score += 300;
  if (startsAlias) score += 220;
  if (nameStarts) score += 180;
  if (hayNorm.includes(q)) score += 90;
  if (place.type === 'airport') score += q.includes('flug') || q.includes('air') || q.includes('prn') ? 45 : 12;
  if (place.address.toLowerCase().includes('kosovo')) score += 40;
  return score;
}

export function getTaxiPresetPlaceHints(query, limit = 6) {
  const q = normalize(query);
  if (q.length < 3) return [];
  return PRESET_PLACES
    .map((place) => ({ ...place, _score: scorePreset(place, q) }))
    .filter((place) => place._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...place }) => place);
}

export function dedupeTaxiPlaces(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.address || item.name}-${item.lat}-${item.lng}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
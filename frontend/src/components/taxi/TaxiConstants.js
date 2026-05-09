// Shared constants for the Taxi module. Extracted from TaxiPage.jsx (iter57c).

export const MAP_STYLES = {
  streets: { name: 'Streets', style: 'mapbox://styles/mapbox/streets-v12' },
  light: { name: 'Hell', style: 'mapbox://styles/mapbox/light-v11' },
  dark: { name: 'Dunkel', style: 'mapbox://styles/mapbox/dark-v11' },
  satellite: { name: 'Satellit', style: 'mapbox://styles/mapbox/satellite-streets-v12' },
};

export const STATUS_COLORS = {
  requested: 'bg-yellow-500/20 text-yellow-400',
  accepted: 'bg-blue-500/20 text-blue-400',
  arriving: 'bg-cyan-500/20 text-cyan-400',
  started: 'bg-green-500/20 text-green-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

export const STATUS_LABELS = {
  requested: 'Suche Fahrer...',
  accepted: 'Fahrer gefunden',
  arriving: 'Fahrer kommt',
  started: 'Fahrt läuft',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

// Legacy mapping (kept for history list fallback)
export const VEHICLE_ICONS = {
  standard: 'standard',
  premium: 'premium',
  van: 'van',
};

// POI categories shown in the "In der Nähe"-Filter (taxi.eu parity).
export const POI_CATEGORIES = {
  restaurant: { label: 'Restaurants', color: '#F97316', icon: '🍽', filter: ['restaurant', 'fast_food', 'cafe', 'food'] },
  supermarket: { label: 'Supermärkte', color: '#10B981', icon: '🛒', filter: ['grocery', 'supermarket', 'convenience', 'department_store'] },
  fuel: { label: 'Tankstellen', color: '#EF4444', icon: '⛽', filter: ['fuel'] },
  pharmacy: { label: 'Apotheken', color: '#22C55E', icon: '💊', filter: ['pharmacy'] },
  atm: { label: 'Geldautomat', color: '#FBBF24', icon: '🏧', filter: ['atm', 'bank'] },
  station: { label: 'Bahnhöfe', color: '#8B5CF6', icon: '🚉', filter: ['rail_station', 'station', 'bus_station'] },
};

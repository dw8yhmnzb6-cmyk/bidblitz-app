// Food module shared constants
export const ORDER_STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  confirmed: 'bg-blue-500/20 text-blue-400',
  preparing: 'bg-orange-500/20 text-orange-400',
  picked_up: 'bg-cyan-500/20 text-cyan-400',
  delivered: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

export const ORDER_STATUS_LABELS = {
  pending: 'Warte auf Bestätigung',
  confirmed: 'Bestätigt',
  preparing: 'Wird zubereitet',
  picked_up: 'Unterwegs',
  delivered: 'Geliefert',
  cancelled: 'Storniert',
};

export const ORDER_STATUS_ICONS = {
  pending: '⏳',
  confirmed: '✅',
  preparing: '👨‍🍳',
  picked_up: '🛵',
  delivered: '📦',
  cancelled: '❌',
};

export const TOP_CATEGORIES = [
  { id: 'restaurants', icon: '🍔', label: 'Restaurants' },
  { id: 'groceries', icon: '🍌', label: 'Lebensmittel' },
  { id: 'alcohol', icon: '🍷', label: 'Alkohol' },
  { id: 'kiosk', icon: '📦', label: 'Kioske' },
];

export const CUISINES = [
  { icon: '🍕', label: 'Italienisch', color: 'from-orange-500/20' },
  { icon: '🥘', label: 'Chinesisch', color: 'from-purple-500/20' },
  { icon: '🍔', label: 'Burger', color: 'from-pink-500/20' },
  { icon: '🍕', label: 'Pizza', color: 'from-orange-500/20' },
  { icon: '🍣', label: 'Sushi', color: 'from-blue-500/20' },
  { icon: '🌮', label: 'Mexikanisch', color: 'from-yellow-500/20' },
  { icon: '🍛', label: 'Indisch', color: 'from-red-500/20' },
  { icon: '🥗', label: 'Gesund', color: 'from-green-500/20' },
];

export const getFoodImage = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('döner') || n.includes('doner')) return 'https://images.unsplash.com/photo-1633321702518-7feccafb94d5?w=200&h=200&fit=crop';
  if (n.includes('pizza')) return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop';
  if (n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop';
  if (n.includes('pasta') || n.includes('spaghetti')) return 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=200&h=200&fit=crop';
  if (n.includes('salat') || n.includes('salad')) return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop';
  if (n.includes('lahmacun')) return 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=200&h=200&fit=crop';
  if (n.includes('pommes') || n.includes('fries')) return 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200&h=200&fit=crop';
  if (n.includes('kebab') || n.includes('grill')) return 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=200&fit=crop';
  if (n.includes('wrap')) return 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=200&h=200&fit=crop';
  if (n.includes('box') || n.includes('teller')) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop';
  if (n.includes('suppe') || n.includes('soup')) return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&h=200&fit=crop';
  if (n.includes('falafel')) return 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb5?w=200&h=200&fit=crop';
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop';
};

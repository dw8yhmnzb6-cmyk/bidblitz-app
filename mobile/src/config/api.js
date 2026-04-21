export const API_URL = 'https://bidblitz.ae/api';

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  ME: '/auth/me',
  REFRESH: '/auth/refresh',
  
  // Auctions
  AUCTIONS_LIST: '/auctions/list',
  AUCTION_DETAIL: '/auctions',
  PLACE_BID: '/auctions/bid',
  MY_AUCTIONS: '/auctions/user',
  
  // Wallet
  WALLET_BALANCE: '/wallet/balance',
  TRANSACTIONS: '/transactions',
  
  // Stripe
  STRIPE_CHECKOUT: '/stripe/checkout',
  STRIPE_PACKAGES: '/stripe/packages',
  STRIPE_STATUS: '/stripe/checkout/status',
  
  // Push Notifications
  PUSH_SUBSCRIBE: '/push/subscribe',
  PUSH_VAPID_KEY: '/push/vapid-public-key',
  
  // Friends Map
  FRIENDS_MAP_SETTINGS: '/friends-map/settings',
  FRIENDS_MAP_UPDATE: '/friends-map/update-location',
  FRIENDS_NEARBY: '/friends-map/friends-nearby',
  
  // Profile
  PROFILE_UPDATE: '/profile',
  NOTIFICATIONS: '/notifications',
};
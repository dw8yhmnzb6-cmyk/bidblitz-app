import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// API Base URL - Change this to your production URL
const API_BASE_URL = 'https://api-gateway-44.preview.emergentagent.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Storage abstraction for web and native
const getToken = async () => {
  if (Platform.OS === 'web') {
    return localStorage.getItem('token');
  }
  return SecureStore.getItemAsync('token');
};

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  try {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.log('Error getting token:', error);
  }
  return config;
});

// API Functions
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
};

export const auctionsAPI = {
  getAll: (params) => api.get('/auctions', { params }),
  getOne: (id) => api.get(`/auctions/${id}`),
  getEnded: (params) => api.get('/auctions/ended', { params }),
  placeBid: (auctionId) => api.post(`/auctions/${auctionId}/bid`),
};

export const productsAPI = {
  getAll: () => api.get('/products'),
};

export const userAPI = {
  getBids: () => api.get('/user/bids'),
  getStats: () => api.get('/user-stats/my-stats'),
  getWonAuctions: () => api.get('/auctions/won'),
  buyBids: (packageId) => api.post('/payments/buy-bids', { package_id: packageId }),
};

export const jackpotAPI = {
  getStatus: () => api.get('/excitement/global-jackpot'),
};

export const checkoutAPI = {
  createSession: (packageId) => api.post('/checkout/create-session', { package_id: packageId }),
  getPaymentMethods: () => api.get('/checkout/payment-methods'),
};

export const dailyRewardAPI = {
  getStatus: () => api.get('/auth/daily-reward-status'),
  claim: () => api.post('/auth/claim-daily-reward'),
};

// Achievements API
export const achievementsAPI = {
  getAll: (language = 'de') => api.get(`/achievements/all?language=${language}`),
  getMy: (language = 'de') => api.get(`/achievements/my-achievements?language=${language}`),
  getProgress: () => api.get('/achievements/progress'),
};

// Winner Gallery API
export const winnerGalleryAPI = {
  getFeed: (params) => api.get('/winner-gallery/feed', { params }),
  getEntry: (id) => api.get(`/winner-gallery/${id}`),
  like: (id) => api.post(`/winner-gallery/${id}/like`),
  upload: (data) => api.post('/winner-gallery/upload', data),
  getMySubmissions: () => api.get('/winner-gallery/my-submissions'),
};

// Buy it Now API
export const buyItNowAPI = {
  getBidsUsed: (auctionId) => api.get(`/buy-it-now/bids-used/${auctionId}`),
  getAvailable: () => api.get('/buy-it-now/available'),
  purchase: (data) => api.post('/buy-it-now/purchase', data),
};

// Daily Spin / Wheel API
export const wheelAPI = {
  getStatus: () => api.get('/wheel/status'),
  spin: () => api.post('/wheel/spin'),
};

// Mystery Box API
export const mysteryBoxAPI = {
  getAll: () => api.get('/mystery-box'),
  open: (boxId) => api.post(`/mystery-box/${boxId}/open`),
};

// Favorites API
export const favoritesAPI = {
  getAll: () => api.get('/favorites'),
  add: (auctionId) => api.post('/favorites/add', { auction_id: auctionId }),
  remove: (auctionId) => api.delete(`/favorites/${auctionId}`),
};

// Bid Buddy API
export const bidBuddyAPI = {
  getAll: () => api.get('/bid-buddy'),
  create: (data) => api.post('/bid-buddy/create', data),
  stop: (id) => api.post(`/bid-buddy/${id}/stop`),
};

export default api;

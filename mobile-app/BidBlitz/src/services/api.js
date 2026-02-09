import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// API Base URL - Change this to your production URL
const API_BASE_URL = 'https://bidblitz-mobile.preview.emergentagent.com/api';

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
  getStatus: () => api.get('/wheel/jackpot'),
};

export const checkoutAPI = {
  createSession: (packageId) => api.post('/checkout/create-session', { package_id: packageId }),
  getPaymentMethods: () => api.get('/checkout/payment-methods'),
};

export const dailyRewardAPI = {
  getStatus: () => api.get('/auth/daily-reward-status'),
  claim: () => api.post('/auth/claim-daily-reward'),
};

export default api;

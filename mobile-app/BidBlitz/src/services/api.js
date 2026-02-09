import axios from 'axios';
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

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('token');
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
  getStats: () => api.get('/user/stats'),
  buyBids: (packageId) => api.post('/payments/buy-bids', { package_id: packageId }),
};

export const jackpotAPI = {
  getStatus: () => api.get('/jackpot/status'),
};

export default api;

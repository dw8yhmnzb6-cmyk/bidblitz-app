import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Helper to safely get/set storage (works in Safari private mode)
const safeStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      try {
        sessionStorage.setItem(key, value);
      } catch (e2) {
        console.warn('Storage not available');
      }
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (e) {}
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(safeStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Auth error:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password, referralCode = null) => {
    const response = await axios.post(`${API}/auth/register`, { 
      name, 
      email, 
      password,
      referral_code: referralCode
    });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  // Login for influencers - sets token and user from influencer login response
  const loginAsInfluencer = (tokenData, userData) => {
    localStorage.setItem('token', tokenData);
    setToken(tokenData);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('influencer_data');
    setToken(null);
    setUser(null);
  };

  const updateBidsBalance = (newBalance) => {
    if (user) {
      setUser({ ...user, bids_balance: newBalance });
    }
  };

  const refreshUser = async () => {
    if (token) {
      await fetchUser();
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      register, 
      logout, 
      loginAsInfluencer,
      updateBidsBalance,
      refreshUser,
      updateUser,
      isAuthenticated: !!user,
      isAdmin: user?.is_admin || false,
      isInfluencer: user?.is_influencer || false,
      isVip: user?.is_vip || false,
      isManager: user?.is_manager || user?.role === 'manager' || false
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

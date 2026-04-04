import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { api } from '../services/api';

const AUTH_ACTIONS = {
  SET_USER: 'SET_USER',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SESSION_CHECKED: 'SESSION_CHECKED',
};

const guestState = {
  id: null,
  name: '',
  email: '',
  role: '',
  balance: 0,
  currency: 'EUR',
  cardNumber: '',
  cardExpiry: '',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BidBlitz',
  isPremium: true,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  sessionReady: false,
  created_at: '',
  language: 'de',
  notifications_enabled: true,
  email_notifications: true,
  biometric_enabled: false,
  dark_mode: true,
};

function mapUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role || 'user',
    balance: u.balance ?? 0,
    currency: u.currency || 'EUR',
    cardNumber: u.card_number || '',
    cardExpiry: u.card_expiry || '',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BidBlitz',
    isPremium: true,
    isAuthenticated: true,
    created_at: u.created_at || '',
    language: u.language || 'de',
    notifications_enabled: u.notifications_enabled !== false,
    email_notifications: u.email_notifications !== false,
    biometric_enabled: u.biometric_enabled === true,
    dark_mode: u.dark_mode !== false,
  };
}

function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload, error: null };
    case AUTH_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    case AUTH_ACTIONS.SET_USER: {
      const u = action.payload;
      return { ...state, ...mapUser(u), isLoading: false, error: null, sessionReady: true };
    }
    case AUTH_ACTIONS.LOGOUT:
      return { ...guestState, sessionReady: true };
    case AUTH_ACTIONS.SESSION_CHECKED:
      return { ...state, sessionReady: true };
    default:
      return state;
  }
}

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, guestState);

  // Restore session via cookie on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await api.getMe();
        if (!cancelled) dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
      } catch {
        if (!cancelled) dispatch({ type: AUTH_ACTIONS.SESSION_CHECKED });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    if (!email || !password) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Please fill in all fields' });
      return false;
    }
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      const user = await api.login({ email, password });
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
      return true;
    } catch (err) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: err.message });
      return false;
    }
  }, []);

  const register = useCallback(async (name, email, password, confirmPassword) => {
    if (!name || !email || !password) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Please fill in all fields' });
      return false;
    }
    if (password !== confirmPassword) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Passwords do not match' });
      return false;
    }
    if (password.length < 6) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Password must be at least 6 characters' });
      return false;
    }
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      const user = await api.register({ name, email, password });
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
      return true;
    } catch (err) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: err.message });
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await api.getMe();
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
    } catch {}
  }, []);

  const value = {
    id: state.id,
    name: state.name,
    email: state.email,
    role: state.role,
    avatar: state.avatar,
    isPremium: state.isPremium,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    sessionReady: state.sessionReady,
    created_at: state.created_at,
    language: state.language,
    notifications_enabled: state.notifications_enabled,
    email_notifications: state.email_notifications,
    biometric_enabled: state.biometric_enabled,
    dark_mode: state.dark_mode,
    login,
    register,
    logout,
    refreshUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}

export default UserContext;

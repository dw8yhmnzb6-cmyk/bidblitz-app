import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { initialUser } from '../models/initialData';

const STORAGE_KEY = 'bidblitz_auth';

const AUTH_ACTIONS = {
  LOGIN: 'LOGIN',
  REGISTER: 'REGISTER',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  RESTORE_SESSION: 'RESTORE_SESSION',
};

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveSession(user) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {}
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const guestState = {
  id: null,
  name: '',
  email: '',
  avatar: '',
  isPremium: false,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  sessionReady: false,
};

function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload, error: null };

    case AUTH_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };

    case AUTH_ACTIONS.LOGIN:
    case AUTH_ACTIONS.REGISTER:
    case AUTH_ACTIONS.RESTORE_SESSION: {
      const u = action.payload;
      return {
        ...state,
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar || initialUser.avatar,
        isPremium: u.isPremium ?? true,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        sessionReady: true,
      };
    }

    case AUTH_ACTIONS.LOGOUT:
      return { ...guestState, sessionReady: true };

    default:
      return state;
  }
}

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, guestState);

  // Restore session on mount
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.isAuthenticated) {
      dispatch({ type: AUTH_ACTIONS.RESTORE_SESSION, payload: saved });
    } else {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  }, []);

  const login = useCallback(async (email, password) => {
    if (!email || !password) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Please fill in all fields' });
      return false;
    }
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 1200));

    const user = {
      id: 'user_' + Date.now().toString(36),
      name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
      email,
      avatar: initialUser.avatar,
      isPremium: true,
      isAuthenticated: true,
    };
    saveSession(user);
    dispatch({ type: AUTH_ACTIONS.LOGIN, payload: user });
    return true;
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

    await new Promise((r) => setTimeout(r, 1400));

    const user = {
      id: 'user_' + Date.now().toString(36),
      name,
      email,
      avatar: initialUser.avatar,
      isPremium: true,
      isAuthenticated: true,
    };
    saveSession(user);
    dispatch({ type: AUTH_ACTIONS.REGISTER, payload: user });
    return true;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  }, []);

  const updateUser = useCallback((updates) => {
    const merged = { ...state, ...updates };
    saveSession(merged);
    dispatch({ type: AUTH_ACTIONS.RESTORE_SESSION, payload: merged });
  }, [state]);

  const value = {
    id: state.id,
    name: state.name,
    email: state.email,
    avatar: state.avatar,
    isPremium: state.isPremium,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    sessionReady: state.sessionReady,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export default UserContext;

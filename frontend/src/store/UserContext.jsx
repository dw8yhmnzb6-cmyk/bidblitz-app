import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { isAdminUser } from '../utils/adminAccess';

function formatUserFacingAuthError(err) {
  const message = String(err?.message || err || '').trim();
  if (!message) return 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.';
  if (message.includes('Invalid email or password')) return 'E-Mail oder Passwort ist falsch.';
  if (message.includes('Session abgelaufen')) return 'Sitzung abgelaufen. Bitte erneut anmelden.';
  if (message.includes('Access restricted during soft launch')) return 'Zugriff aktuell eingeschränkt. Bitte Support kontaktieren.';
  if (message.includes('Passwort-Reset erforderlich')) return message;
  if (message.includes('Email already registered')) return 'Diese E-Mail ist bereits registriert.';
  if (message.includes('Password must be at least 6 characters')) return 'Passwort muss mindestens 6 Zeichen haben.';
  if (message.includes('Passwords do not match')) return 'Die Passwörter stimmen nicht überein.';
  return message;
}

const AUTH_ACTIONS = {
  SET_USER: 'SET_USER',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SESSION_CHECKED: 'SESSION_CHECKED',
  SET_2FA_PENDING: 'SET_2FA_PENDING',
  SET_MODE: 'SET_MODE',
};

const guestState = {
  id: null,
  name: '',
  email: '',
  login_email: '',
  canonical_email: '',
  display_email: '',
  role: '',
  modes: [],
  currentMode: 'personal',
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
  kyc_status: 'not_started',
  kyc_verified: false,
  requires2FA: false,
  twoFAEmailHint: '',
};

function mapUser(u) {
  const role = u.role || 'user';
  const isAdmin = isAdminUser({ ...u, role });
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    login_email: u.login_email || u.email,
    canonical_email: u.canonical_email || u.email,
    display_email: u.login_email || u.email,
    role,
    modes: u.modes || ['personal'],
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
    kyc_status: isAdmin ? 'approved' : (u.kyc_status || 'not_started'),
    kyc_verified: isAdmin || u.kyc_verified === true || u.kyc_status === 'approved',
  };
}

function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload, error: null };
    case AUTH_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    case AUTH_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    case AUTH_ACTIONS.SET_USER: {
      const u = action.payload;
      const mapped = mapUser(u);
      // Restore saved mode or default to personal
      let savedMode = 'personal';
      try { savedMode = localStorage.getItem('bidblitz_mode') || 'personal'; } catch (storageError) { void storageError; }
      const validMode = mapped.modes.includes(savedMode) ? savedMode : 'personal';
      return { ...state, ...mapped, currentMode: validMode, isLoading: false, error: null, sessionReady: true, requires2FA: false };
    }
    case AUTH_ACTIONS.SET_MODE: {
      const mode = action.payload;
      if (state.modes.includes(mode)) {
        try { localStorage.setItem('bidblitz_mode', mode); } catch (storageError) { void storageError; }
        return { ...state, currentMode: mode };
      }
      return state;
    }
    case AUTH_ACTIONS.SET_2FA_PENDING:
      return { ...state, requires2FA: true, twoFAEmailHint: action.payload || '', isLoading: false, error: null };
    case AUTH_ACTIONS.LOGOUT:
      try { localStorage.removeItem('bidblitz_mode'); } catch (storageError) { void storageError; }
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
        // Try refresh token before giving up
        try {
          const refreshed = await api.refresh();
          if (!cancelled && refreshed) dispatch({ type: AUTH_ACTIONS.SET_USER, payload: refreshed });
        } catch {
          if (!cancelled) dispatch({ type: AUTH_ACTIONS.SESSION_CHECKED });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Silent refresh every 45 minutes to keep session alive
  useEffect(() => {
    if (!state.isAuthenticated) return;
    const interval = setInterval(async () => {
      try {
        await api.refresh();
      } catch (refreshError) {
        void refreshError;
      }
    }, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.isAuthenticated]);

  const login = useCallback(async (email, password, rememberMe = true) => {
    if (!email || !password) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Please fill in all fields' });
      return false;
    }
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      try {
        await api.logout();
      } catch (logoutError) {
        void logoutError;
      }
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      const response = await api.login({ email, password, remember_me: rememberMe });
      
      // Check if 2FA is required
      if (response.requires_2fa) {
        dispatch({ type: AUTH_ACTIONS.SET_2FA_PENDING, payload: response.email_hint || '' });
        return '2fa_required';
      }
      
      // CRITICAL FIX v2: Deep clone via JSON to ensure plain object (removes all non-serializable data)
      const rawData = response.user || response;
      const userData = JSON.parse(JSON.stringify(rawData));
      const requestedEmail = String(email || '').trim().toLowerCase();
      const actualLoginEmail = String(userData.login_email || userData.email || '').trim().toLowerCase();
      const actualCanonicalEmail = String(userData.canonical_email || userData.email || '').trim().toLowerCase();
      if (requestedEmail && actualLoginEmail && requestedEmail !== actualLoginEmail && requestedEmail !== actualCanonicalEmail) {
        throw new Error(`Falsches Konto geladen: erwartet ${requestedEmail}, erhalten ${actualLoginEmail || actualCanonicalEmail}`);
      }
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: userData });
      return true;
    } catch (err) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: formatUserFacingAuthError(err) });
      return false;
    }
  }, []);

  const verify2FA = useCallback(async (code) => {
    if (!code || code.length !== 6) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: '6-stelliger Code erforderlich' });
      return false;
    }
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      const user = await api.verify2FA({ code });
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
      return true;
    } catch (err) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: formatUserFacingAuthError(err) });
      return false;
    }
  }, []);

  const cancel2FA = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  }, []);

  const register = useCallback(async (name, email, password, confirmPassword, requestedRole) => {
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
      const body = { name, email, password };
      if (requestedRole && requestedRole !== "customer") body.requested_role = requestedRole;
      await api.register(body);
      const loginResponse = await api.login({ email, password, remember_me: true });
      const userData = JSON.parse(JSON.stringify(loginResponse.user || loginResponse));
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: userData });
      // 🎁 Welcome Bonus Toast
      try {
        const { toast } = await import("sonner");
        toast.success("🎁 Willkommen bei BidBlitz!", {
          description: "Du hast 5,00 € + 10 BLZ Willkommens-Bonus erhalten!",
          duration: 6000,
        });
      } catch (toastError) {
        void toastError;
      }
      return true;
    } catch (err) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: formatUserFacingAuthError(err) });
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch (logoutError) { void logoutError; }
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await api.getMe();
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
    } catch (refreshUserError) {
      void refreshUserError;
    }
  }, []);

  const setMode = useCallback((mode) => {
    dispatch({ type: AUTH_ACTIONS.SET_MODE, payload: mode });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  // CRITICAL FIX: Wrap context value in useMemo to prevent React 19 StrictMode cloning issues
  // React 19 tries to clone the entire context value during reconciliation
  // Functions cannot be cloned → "The object can not be cloned" error
  const value = React.useMemo(() => ({
    id: state.id,
    name: state.name,
    email: state.email,
    login_email: state.login_email,
    canonical_email: state.canonical_email,
    display_email: state.display_email,
    kyc_status: state.kyc_status,
    kyc_verified: state.kyc_verified,
    role: state.role,
    modes: state.modes,
    currentMode: state.currentMode,
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
    requires2FA: state.requires2FA,
    twoFAEmailHint: state.twoFAEmailHint,
    login,
    verify2FA,
    cancel2FA,
    register,
    logout,
    refreshUser,
    setMode,
    clearError,
  }), [state, login, verify2FA, cancel2FA, register, logout, refreshUser, setMode, clearError]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}

export default UserContext;

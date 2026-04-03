/**
 * BidBlitz V2 - Auth Service
 * Handles authentication operations.
 * Currently uses localStorage mock. Replace internals with real API calls later.
 */

const STORAGE_KEY = 'bidblitz_auth';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

class AuthService {
  /**
   * Login with email/password
   * TODO: Replace with real API call → POST /api/auth/login
   */
  async login(email, password) {
    await delay(1200);
    const user = {
      id: 'user_' + Date.now().toString(36),
      name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
      email,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BidBlitz',
      isPremium: true,
    };
    this._saveSession(user);
    return { success: true, user };
  }

  /**
   * Register a new account
   * TODO: Replace with real API call → POST /api/auth/register
   */
  async register(name, email, password) {
    await delay(1400);
    const user = {
      id: 'user_' + Date.now().toString(36),
      name,
      email,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BidBlitz',
      isPremium: true,
    };
    this._saveSession(user);
    return { success: true, user };
  }

  /**
   * Logout current user
   * TODO: Replace with real API call → POST /api/auth/logout
   */
  async logout() {
    this._clearSession();
    return { success: true };
  }

  /**
   * Get current session from storage
   * TODO: Replace with real API call → GET /api/auth/me
   */
  async getSession() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { authenticated: false, user: null };
    try {
      const user = JSON.parse(raw);
      return { authenticated: true, user };
    } catch {
      return { authenticated: false, user: null };
    }
  }

  /**
   * Refresh session / token
   * TODO: Replace with real API call → POST /api/auth/refresh
   */
  async refreshSession() {
    const session = await this.getSession();
    return session;
  }

  _saveSession(user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...user, isAuthenticated: true }));
  }

  _clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const authService = new AuthService();
export default authService;

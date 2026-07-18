/**
 * Legacy auth service wrapper.
 *
 * Uses real backend cookie auth and actively removes the old
 * `bidblitz_auth` localStorage mock key.
 */

import { api } from './api';

const LEGACY_STORAGE_KEY = 'bidblitz_auth';

export function purgeLegacyAuthStorage() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    void error;
  }
}

class AuthService {
  constructor() {
    purgeLegacyAuthStorage();
  }

  async login(email, password) {
    purgeLegacyAuthStorage();
    const response = await api.login({ email, password, remember_me: true });
    return response.user || response;
  }

  async register(name, email, password) {
    purgeLegacyAuthStorage();
    await api.register({ name, email, password });
    const response = await api.login({ email, password, remember_me: true });
    return response.user || response;
  }

  async logout() {
    purgeLegacyAuthStorage();
    try {
      await api.logout();
    } finally {
      purgeLegacyAuthStorage();
    }
    return { success: true };
  }

  async getSession() {
    purgeLegacyAuthStorage();
    try {
      const user = await api.getMe();
      return { authenticated: true, user };
    } catch {
      return { authenticated: false, user: null };
    }
  }

  async refreshSession() {
    purgeLegacyAuthStorage();
    try {
      const user = await api.refresh();
      return { authenticated: true, user };
    } catch {
      return this.getSession();
    }
  }
}

export const authService = new AuthService();
export default authService;

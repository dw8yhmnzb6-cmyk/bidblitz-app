import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // null = checking, false = not authenticated, object = authenticated
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const userData = await api.getMe();
      setUser(userData);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email, password) => {
    const userData = await api.login({ email, password });
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const userData = await api.register({ email, password, name });
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setUser(false);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await api.getMe();
      setUser(userData);
    } catch {
      // ignore
    }
  }, []);

  return (
    <AuthContext.Provider value={React.useMemo(() => ({ user, loading, login, register, logout, refreshUser }), [user, loading, login, register, logout, refreshUser])}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

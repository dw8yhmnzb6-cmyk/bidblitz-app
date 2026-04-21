import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/ApiService';
import { API_ENDPOINTS } from '../config/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userData = await AsyncStorage.getItem('user');
      
      if (token && userData) {
        setUser(JSON.parse(userData));
        setIsAuthenticated(true);
        
        // Refresh user data
        try {
          const response = await ApiService.get(API_ENDPOINTS.ME);
          setUser(response.user);
          await AsyncStorage.setItem('user', JSON.stringify(response.user));
        } catch (error) {
          console.log('Failed to refresh user data');
        }
      }
    } catch (error) {
      console.error('Load auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await ApiService.post(API_ENDPOINTS.LOGIN, {
        email,
        password,
      });

      if (response.token) {
        await AsyncStorage.setItem('auth_token', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        setUser(response.user);
        setIsAuthenticated(true);
        return { success: true };
      }
      
      return { success: false, error: 'Invalid credentials' };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await ApiService.post(API_ENDPOINTS.REGISTER, {
        name,
        email,
        password,
      });

      if (response.token) {
        await AsyncStorage.setItem('auth_token', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        setUser(response.user);
        setIsAuthenticated(true);
        return { success: true };
      }
      
      return { success: false, error: 'Registration failed' };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Registration failed',
      };
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUserBalance = (newBalance) => {
    setUser(prev => ({ ...prev, balance: newBalance }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        register,
        logout,
        updateUserBalance,
      }}
    >
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
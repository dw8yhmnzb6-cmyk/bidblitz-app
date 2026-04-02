/**
 * BidBlitz V2 - User Context
 * Global state management for user data
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { initialUser } from '../models/initialData';

// Action types
const USER_ACTIONS = {
  SET_USER: 'SET_USER',
  UPDATE_USER: 'UPDATE_USER',
  LOGOUT: 'LOGOUT',
};

// Initial state
const initialState = {
  ...initialUser,
  isAuthenticated: true, // Demo mode - always authenticated
  isLoading: false,
};

// Reducer
function userReducer(state, action) {
  switch (action.type) {
    case USER_ACTIONS.SET_USER:
      return {
        ...state,
        ...action.payload,
        isAuthenticated: true,
      };

    case USER_ACTIONS.UPDATE_USER:
      return {
        ...state,
        ...action.payload,
      };

    case USER_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isAuthenticated: false,
      };

    default:
      return state;
  }
}

// Context
const UserContext = createContext(null);

// Provider component
export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, initialState);

  const setUser = useCallback((userData) => {
    dispatch({
      type: USER_ACTIONS.SET_USER,
      payload: userData,
    });
  }, []);

  const updateUser = useCallback((updates) => {
    dispatch({
      type: USER_ACTIONS.UPDATE_USER,
      payload: updates,
    });
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: USER_ACTIONS.LOGOUT });
  }, []);

  const value = {
    // State
    id: state.id,
    name: state.name,
    email: state.email,
    avatar: state.avatar,
    isPremium: state.isPremium,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    
    // Actions
    setUser,
    updateUser,
    logout,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

// Hook
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export default UserContext;

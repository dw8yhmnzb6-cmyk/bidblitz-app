/**
 * PopupManager - Manages floating popups based on current route
 * Uses useLocation to reactively hide popups on excluded pages
 */
import React from 'react';
import { useLocation } from 'react-router-dom';
import AbandonedCartReminder from './AbandonedCartReminder';
import OutbidNotification from './OutbidNotification';
import OnboardingTour from './OnboardingTour';
import DailyLoginPopup from './DailyLoginPopup';
import { useAuth } from '../context/AuthContext';

// Wrapper for DailyLoginPopup with full functionality
const DailyLoginPopupWrapper = ({ language }) => {
  const { isAuthenticated, token, refreshUser } = useAuth();
  
  const handleRewardClaimed = async (data) => {
    // Refresh user data to update bids_balance in navbar
    console.log('Daily reward claimed:', data);
    if (refreshUser) {
      await refreshUser();
    }
  };
  
  return (
    <DailyLoginPopup 
      language={language}
      token={token}
      isAuthenticated={isAuthenticated}
      onRewardClaimed={handleRewardClaimed}
    />
  );
};

const PopupManager = ({ language }) => {
  const location = useLocation();
  const pathname = location.pathname;
  
  // List of paths where popups should NOT be shown
  const excludedPaths = [
    '/pos',
    '/kiosk',
    '/kasse',
    '/scanner',
    '/mitarbeiter-kasse',
    '/staff-pos',
    '/checkout/',
    '/mein-qr',
    '/my-qr',
    '/wallet-card',
    '/meine-karte',
    '/zahlungen',
    '/payment-history',
    '/admin',
    '/developers',
    '/enterprise',
    '/grosshaendler',
    '/bidblitz-pay',
    '/login',
    '/register',
    '/profile',
    '/settings',
    '/wallet'
  ];
  
  // Check if current path is excluded
  const isExcluded = excludedPaths.some(path => pathname.includes(path));
  
  // Don't render popups on excluded paths
  if (isExcluded) {
    return null;
  }
  
  return (
    <>
      <AbandonedCartReminder language={language} />
      <OutbidNotification />
      <OnboardingTour />
      <DailyLoginPopupWrapper language={language} />
    </>
  );
};

export default PopupManager;

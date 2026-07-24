/**
 * useTaxiState - Centralized state management for Taxi booking
 * Reduces TaxiPage.jsx complexity by extracting 40+ state variables
 */

import { useState } from 'react';

export function useTaxiState() {
  // Core booking state
  const [view, setView] = useState('book'); // book, tracking, history
  const [taxiType, setTaxiType] = useState('business'); // '', 'business', 'private' — default to 'business' so map renders immediately on landing (competitor parity)
  const [pickup, setPickup] = useState({ lat: 0, lng: 0, address: '' });
  const [dropoff, setDropoff] = useState({ lat: 0, lng: 0, address: '' });
  const [estimates, setEstimates] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Ride state
  const [activeRide, setActiveRide] = useState(null);
  const [rideHistory, setRideHistory] = useState([]);
  
  // Module status
  const [moduleEnabled, setModuleEnabled] = useState(true);
  const [moduleMessage, setModuleMessage] = useState('');
  const [surge, setSurge] = useState({ active: false, multiplier: 1.0 });
  const [userBalance, setUserBalance] = useState(0);
  
  // Map preferences
  const [mapStyle, setMapStyle] = useState(
    typeof window !== 'undefined' 
      ? (window.localStorage.getItem('bidblitz_map_style') || 'streets') 
      : 'streets'
  );
  const [showMapStyles, setShowMapStyles] = useState(false);
  
  // Modals & UI state
  const [showReview, setShowReview] = useState(false);
  const [reviewRideId, setReviewRideId] = useState(null);
  const [showSplit, setShowSplit] = useState(false);
  const [splitRideId, setSplitRideId] = useState(null);
  const [splitTotal, setSplitTotal] = useState(0);
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [showGroupRide, setShowGroupRide] = useState(false);
  const [showDriverOnboarding, setShowDriverOnboarding] = useState(false);
  const [onboardingType, setOnboardingType] = useState('');
  
  // Favorites
  const [favorites, setFavorites] = useState([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSaveFavorite, setShowSaveFavorite] = useState(false);
  const [favoriteForm, setFavoriteForm] = useState({ name: '', icon: 'star' });
  
  // Autocomplete
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [showPickupSugg, setShowPickupSugg] = useState(false);
  const [showDropoffSugg, setShowDropoffSugg] = useState(false);
  
  // Saved places
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveIcon, setSaveIcon] = useState('star');
  
  // POI Filter
  const [activePoiCategory, setActivePoiCategory] = useState(null);
  const [showPoiFilter, setShowPoiFilter] = useState(false);
  const [poiLoading, setPoiLoading] = useState(false);

  // Order options (taxi.eu parity)
  const [orderOptions, setOrderOptions] = useState({
    language: 'de',
    withPet: false,
    luggage: 'none',     // 'none' | 'small' | 'much' | 'much_combi'
    assistance: false,
    notes: '',
    scheduledAt: null,   // null => Jetzt; ISO string otherwise
  });
  const [showOrderOptions, setShowOrderOptions] = useState(false);

  // Address Search Sheet (fullscreen overlay)
  const [searchSheetMode, setSearchSheetMode] = useState(null); // null | 'pickup' | 'dropoff' | 'waypoint:N'

  // Waypoints (Mehrere Stops) — list between pickup and dropoff
  const [waypoints, setWaypoints] = useState([]); // [{lat,lng,address,notes}]

  // Recent addresses (auto-tracked server-side)
  const [recentAddresses, setRecentAddresses] = useState([]);

  // Side Menu
  const [showSideMenu, setShowSideMenu] = useState(false);
  
  return {
    // Core
    view, setView,
    taxiType, setTaxiType,
    pickup, setPickup,
    dropoff, setDropoff,
    estimates, setEstimates,
    selectedVehicle, setSelectedVehicle,
    loading, setLoading,
    error, setError,
    
    // Ride
    activeRide, setActiveRide,
    rideHistory, setRideHistory,
    
    // Module
    moduleEnabled, setModuleEnabled,
    moduleMessage, setModuleMessage,
    surge, setSurge,
    userBalance, setUserBalance,
    
    // Map
    mapStyle, setMapStyle,
    showMapStyles, setShowMapStyles,
    
    // Modals
    showReview, setShowReview,
    reviewRideId, setReviewRideId,
    showSplit, setShowSplit,
    splitRideId, setSplitRideId,
    splitTotal, setSplitTotal,
    showLiveChat, setShowLiveChat,
    showGroupRide, setShowGroupRide,
    showDriverOnboarding, setShowDriverOnboarding,
    onboardingType, setOnboardingType,
    
    // Favorites
    favorites, setFavorites,
    showFavorites, setShowFavorites,
    showSaveFavorite, setShowSaveFavorite,
    favoriteForm, setFavoriteForm,
    
    // Autocomplete
    pickupSuggestions, setPickupSuggestions,
    dropoffSuggestions, setDropoffSuggestions,
    showPickupSugg, setShowPickupSugg,
    showDropoffSugg, setShowDropoffSugg,
    
    // Saved Places
    savedPlaces, setSavedPlaces,
    showSaveModal, setShowSaveModal,
    saveName, setSaveName,
    saveIcon, setSaveIcon,
    
    // POI
    activePoiCategory, setActivePoiCategory,
    showPoiFilter, setShowPoiFilter,
    poiLoading, setPoiLoading,

    // Order Options & Search Sheet
    orderOptions, setOrderOptions,
    showOrderOptions, setShowOrderOptions,
    searchSheetMode, setSearchSheetMode,

    // Waypoints + Recent + Side-Menu
    waypoints, setWaypoints,
    recentAddresses, setRecentAddresses,
    showSideMenu, setShowSideMenu,
  };
}

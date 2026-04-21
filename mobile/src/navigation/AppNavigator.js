import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../config/colors';

// Auth Screens
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';

// Main Tabs
import HomeScreen from '../screens/Home/HomeScreen';
import AuctionsScreen from '../screens/Auctions/AuctionsScreen';
import WalletScreen from '../screens/Wallet/WalletScreen';
import ServicesScreen from '../screens/Services/ServicesScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';

// Detail Screens
import AuctionDetailScreen from '../screens/Auctions/AuctionDetailScreen';
import FriendsMapScreen from '../screens/FriendsMap/FriendsMapScreen';
import TaxiScreen from '../screens/Taxi/TaxiScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Auctions') iconName = focused ? 'hammer' : 'hammer-outline';
          else if (route.name === 'Wallet') iconName = focused ? 'wallet' : 'wallet-outline';
          else if (route.name === 'Services') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.lightGray,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Auctions" component={AuctionsScreen} options={{ title: 'Auktionen' }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
      <Tab.Screen name="Services" component={ServicesScreen} options={{ title: 'Services' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // SplashScreen is shown
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="AuctionDetail" component={AuctionDetailScreen} />
          <Stack.Screen name="FriendsMap" component={FriendsMapScreen} />
          <Stack.Screen name="Taxi" component={TaxiScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
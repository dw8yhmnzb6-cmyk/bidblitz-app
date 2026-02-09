import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

// Screens
import HomeScreen from '../screens/HomeScreen';
import AuctionsScreen from '../screens/AuctionsScreen';
import AuctionDetailScreen from '../screens/AuctionDetailScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BuyBidsScreen from '../screens/BuyBidsScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import SettingsScreen from '../screens/SettingsScreen';
// New Feature Screens
import LiveStreamScreen from '../screens/LiveStreamScreen';
import TeamBiddingScreen from '../screens/TeamBiddingScreen';
import AIAdvisorScreen from '../screens/AIAdvisorScreen';
import DuelScreen from '../screens/DuelScreen';
import MysteryBoxScreen from '../screens/MysteryBoxScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator for main app
const TabNavigator = () => {
  const { user } = useAuth();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Auktionen') {
            iconName = focused ? 'hammer' : 'hammer-outline';
          } else if (route.name === 'Gebote') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Profil') {
            iconName = focused ? 'person' : 'person-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#1F2937',
          borderTopColor: '#374151',
          paddingBottom: 5,
          height: 60,
        },
        headerStyle: {
          backgroundColor: '#1F2937',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'BidBlitz' }}
      />
      <Tab.Screen 
        name="Auktionen" 
        component={AuctionsScreen}
      />
      <Tab.Screen 
        name="Favoriten" 
        component={FavoritesScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profil" 
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
};

// Auth Stack for login/register
const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: '#1F2937' },
      headerTintColor: '#fff',
    }}
  >
    <Stack.Screen 
      name="Login" 
      component={LoginScreen}
      options={{ title: 'Anmelden' }}
    />
    <Stack.Screen 
      name="Register" 
      component={RegisterScreen}
      options={{ title: 'Registrieren' }}
    />
  </Stack.Navigator>
);

// Main App Navigator
const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return null; // Or a loading screen
  }
  
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen 
              name="AuctionDetail" 
              component={AuctionDetailScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#1F2937' },
                headerTintColor: '#fff',
                title: 'Auktion',
              }}
            />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#1F2937' },
                headerTintColor: '#fff',
                title: 'Einstellungen',
              }}
            />
            <Stack.Screen 
              name="BuyBids" 
              component={BuyBidsScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#1F2937' },
                headerTintColor: '#fff',
                title: 'Gebote kaufen',
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

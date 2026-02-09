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
import BidBuddyScreen from '../screens/BidBuddyScreen';
import DailySpinScreen from '../screens/DailySpinScreen';
import BuyItNowScreen from '../screens/BuyItNowScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import WinnerGalleryScreen from '../screens/WinnerGalleryScreen';
// 9 NEW Feature Screens
import BidAlarmScreen from '../screens/BidAlarmScreen';
import WelcomeBonusScreen from '../screens/WelcomeBonusScreen';
import ActivityFeedScreen from '../screens/ActivityFeedScreen';
import TournamentScreen from '../screens/TournamentScreen';
import AuctionChatScreen from '../screens/AuctionChatScreen';
import RecommendationsScreen from '../screens/RecommendationsScreen';
import WatchersScreen from '../screens/WatchersScreen';
import RevengeBidScreen from '../screens/RevengeBidScreen';
import WalletScreen from '../screens/WalletScreen';
// 10 NEW Feature Screens (Batch 2)
import EmailPreferencesScreen from '../screens/EmailPreferencesScreen';
import WinnerMediaScreen from '../screens/WinnerMediaScreen';
import BidBundlesScreen from '../screens/BidBundlesScreen';
import VIPPlansScreen from '../screens/VIPPlansScreen';
import TransparencyScreen from '../screens/TransparencyScreen';
import UserReviewsScreen from '../screens/UserReviewsScreen';
import AppStoreScreen from '../screens/AppStoreScreen';
import AffiliateDashboardScreen from '../screens/AffiliateDashboardScreen';
import SocialShareScreen from '../screens/SocialShareScreen';
import UserReportsScreen from '../screens/UserReportsScreen';

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
            {/* New Feature Screens */}
            <Stack.Screen 
              name="LiveStream" 
              component={LiveStreamScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#EF4444' },
                headerTintColor: '#fff',
                title: '📺 Live Auktionen',
              }}
            />
            <Stack.Screen 
              name="TeamBidding" 
              component={TeamBiddingScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '👥 Team Bidding',
              }}
            />
            <Stack.Screen 
              name="AIAdvisor" 
              component={AIAdvisorScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '🧠 KI-Berater',
              }}
            />
            <Stack.Screen 
              name="Duel" 
              component={DuelScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#EF4444' },
                headerTintColor: '#fff',
                title: '⚔️ Duell',
              }}
            />
            <Stack.Screen 
              name="MysteryBox" 
              component={MysteryBoxScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '📦 Mystery Box',
              }}
            />
            <Stack.Screen 
              name="BidBuddy" 
              component={BidBuddyScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '🤖 Bid Buddy',
              }}
            />
            <Stack.Screen 
              name="DailySpin" 
              component={DailySpinScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#F59E0B' },
                headerTintColor: '#fff',
                title: '🎡 Glücksrad',
              }}
            />
            <Stack.Screen 
              name="BuyItNow" 
              component={BuyItNowScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#10B981' },
                headerTintColor: '#fff',
                title: '🛒 Sofortkauf',
              }}
            />
            <Stack.Screen 
              name="Achievements" 
              component={AchievementsScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '🏆 Achievements',
              }}
            />
            <Stack.Screen 
              name="WinnerGallery" 
              component={WinnerGalleryScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#F59E0B' },
                headerTintColor: '#fff',
                title: '🏆 Gewinner-Galerie',
              }}
            />
            {/* 9 NEW Feature Screens */}
            <Stack.Screen 
              name="BidAlarm" 
              component={BidAlarmScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '⏰ Bid-Alarm',
              }}
            />
            <Stack.Screen 
              name="WelcomeBonus" 
              component={WelcomeBonusScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#10B981' },
                headerTintColor: '#fff',
                title: '🎁 Willkommens-Bonus',
              }}
            />
            <Stack.Screen 
              name="ActivityFeed" 
              component={ActivityFeedScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#EC4899' },
                headerTintColor: '#fff',
                title: '📊 Live-Aktivität',
              }}
            />
            <Stack.Screen 
              name="Tournament" 
              component={TournamentScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#F59E0B' },
                headerTintColor: '#fff',
                title: '🏅 Turnier',
              }}
            />
            <Stack.Screen 
              name="AuctionChat" 
              component={AuctionChatScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '💬 Auktions-Chat',
              }}
            />
            <Stack.Screen 
              name="Recommendations" 
              component={RecommendationsScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#EC4899' },
                headerTintColor: '#fff',
                title: '🎯 Empfehlungen',
              }}
            />
            <Stack.Screen 
              name="Watchers" 
              component={WatchersScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '👀 Live-Zuschauer',
              }}
            />
            <Stack.Screen 
              name="RevengeBid" 
              component={RevengeBidScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#EF4444' },
                headerTintColor: '#fff',
                title: '⚡ Revenge Bid',
              }}
            />
            <Stack.Screen 
              name="Wallet" 
              component={WalletScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#3B82F6' },
                headerTintColor: '#fff',
                title: '📱 Digital Wallet',
              }}
            />
            {/* 10 NEW Feature Screens (Batch 2) */}
            <Stack.Screen 
              name="EmailPreferences" 
              component={EmailPreferencesScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '📧 E-Mail Einstellungen',
              }}
            />
            <Stack.Screen 
              name="WinnerMedia" 
              component={WinnerMediaScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#F59E0B' },
                headerTintColor: '#fff',
                title: '📸 Gewinner-Galerie',
              }}
            />
            <Stack.Screen 
              name="BidBundles" 
              component={BidBundlesScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '📦 Gebote-Pakete',
              }}
            />
            <Stack.Screen 
              name="VIPPlans" 
              component={VIPPlansScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#F59E0B' },
                headerTintColor: '#fff',
                title: '👑 VIP-Mitgliedschaft',
              }}
            />
            <Stack.Screen 
              name="Transparency" 
              component={TransparencyScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#10B981' },
                headerTintColor: '#fff',
                title: '📊 Transparenz',
              }}
            />
            <Stack.Screen 
              name="UserReviews" 
              component={UserReviewsScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#F59E0B' },
                headerTintColor: '#fff',
                title: '⭐ Bewertungen',
              }}
            />
            <Stack.Screen 
              name="AppStore" 
              component={AppStoreScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '📱 App Download',
              }}
            />
            <Stack.Screen 
              name="AffiliateDashboard" 
              component={AffiliateDashboardScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#10B981' },
                headerTintColor: '#fff',
                title: '💼 Affiliate-Dashboard',
              }}
            />
            <Stack.Screen 
              name="SocialShare" 
              component={SocialShareScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#EC4899' },
                headerTintColor: '#fff',
                title: '🔗 Teilen & Verdienen',
              }}
            />
            <Stack.Screen 
              name="UserReports" 
              component={UserReportsScreen}
              options={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#8B5CF6' },
                headerTintColor: '#fff',
                title: '🎫 Support',
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

import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './context/AuthContext';
import { STRIPE_NATIVE_ENABLED, STRIPE_PUBLISHABLE_KEY } from './config/stripe';
import PushNotificationService from './services/PushNotificationService';
import SplashScreen from 'react-native-splash-screen';

LogBox.ignoreAllLogs(); // Disable warnings in production

const App = () => {
  useEffect(() => {
    // Initialize Push Notifications
    PushNotificationService.configure();
    
    // Hide splash screen
    setTimeout(() => {
      SplashScreen.hide();
    }, 1000);
  }, []);

  const appContent = (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {STRIPE_NATIVE_ENABLED ? (
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
          {appContent}
        </StripeProvider>
      ) : appContent}
    </GestureHandlerRootView>
  );
};

export default App;
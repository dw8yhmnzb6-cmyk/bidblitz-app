import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import api from '../services/api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Check if notifications are already enabled
    checkNotificationPermissions();

    // Listen for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      console.log('Notification received:', notification);
    });

    // Listen for notification responses (when user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      handleNotificationResponse(response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === 'granted');
  };

  const registerForPushNotifications = async () => {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'BidBlitz',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8B5CF6',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Push-Benachrichtigungen',
          'Bitte aktivieren Sie Benachrichtigungen in den Einstellungen, um keine Auktionen zu verpassen!'
        );
        return null;
      }

      token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'bidblitz-mobile'
      })).data;
      
      console.log('Push token:', token);
    } else {
      // Running on simulator/emulator
      console.log('Push notifications require a physical device');
    }

    if (token) {
      setExpoPushToken(token);
      setNotificationsEnabled(true);
      
      // Send token to backend
      try {
        await api.post('/push-notifications/subscribe', {
          token: token,
          device_type: Platform.OS,
        });
        console.log('Push token registered with backend');
      } catch (error) {
        console.log('Error registering push token:', error);
      }
    }

    return token;
  };

  const disableNotifications = async () => {
    try {
      if (expoPushToken) {
        await api.post('/push-notifications/unsubscribe', {
          token: expoPushToken,
        });
      }
      setNotificationsEnabled(false);
      setExpoPushToken('');
    } catch (error) {
      console.log('Error disabling notifications:', error);
    }
  };

  const handleNotificationResponse = (response) => {
    const data = response.notification.request.content.data;
    
    // Navigate based on notification type
    if (data?.auction_id) {
      // Navigate to auction detail
      console.log('Navigate to auction:', data.auction_id);
    } else if (data?.type === 'won') {
      // Navigate to won auctions
      console.log('Navigate to won auctions');
    }
  };

  // Schedule a local notification (for testing)
  const scheduleLocalNotification = async (title, body, data = {}) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Immediate
    });
  };

  return (
    <NotificationContext.Provider value={{
      expoPushToken,
      notification,
      notificationsEnabled,
      registerForPushNotifications,
      disableNotifications,
      scheduleLocalNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

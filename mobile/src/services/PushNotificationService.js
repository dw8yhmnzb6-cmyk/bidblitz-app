import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { Platform } from 'react-native';
import ApiService from './ApiService';
import { API_ENDPOINTS } from '../config/api';

class PushNotificationService {
  configure = () => {
    PushNotification.configure({
      onRegister: async (token) => {
        console.log('FCM Token:', token);
        await this.subscribeToPush(token.token);
      },

      onNotification: (notification) => {
        console.log('Notification:', notification);
        
        // Handle notification tap
        if (notification.userInteraction) {
          this.handleNotificationTap(notification);
        }

        // iOS: Finish processing
        notification.finish(PushNotificationIOS.FetchResult.NoData);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create channels for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'auction-alerts',
          channelName: 'Auction Alerts',
          channelDescription: 'Notifications for auction wins and outbids',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log(`Channel created: ${created}`)
      );
    }
  };

  subscribeToPush = async (token) => {
    try {
      await ApiService.post(API_ENDPOINTS.PUSH_SUBSCRIBE, {
        endpoint: `fcm:${token}`,
        keys: {
          p256dh: token,
          auth: token,
        },
      });
      console.log('✓ Subscribed to push notifications');
    } catch (error) {
      console.error('Push subscription failed:', error);
    }
  };

  handleNotificationTap = (notification) => {
    const { data } = notification;
    
    // Navigate based on notification type
    if (data?.type === 'auction_won') {
      // Navigate to auction detail
    } else if (data?.type === 'outbid') {
      // Navigate to auction detail
    } else if (data?.type === 'auction_ending') {
      // Navigate to auction detail
    }
  };

  showLocalNotification = (title, message, data = {}) => {
    PushNotification.localNotification({
      channelId: 'auction-alerts',
      title,
      message,
      userInfo: data,
      playSound: true,
      soundName: 'default',
    });
  };

  cancelAllNotifications = () => {
    PushNotification.cancelAllLocalNotifications();
  };
}

export default new PushNotificationService();
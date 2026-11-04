import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bidblitz.app',
  appName: 'BidBlitz',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    // Live-Reload aktivieren: setze CAP_LIVE=1 oder nutze separate config (capacitor.config.live.ts).
    // Production: alle web assets aus build/, kein Server-URL nötig.
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#060810',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#00C2FF',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#060810',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#00C2FF',
    },
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#060810',
  },
  android: {
    // Health Connect is not part of the Android app. Keep it excluded on every sync.
    includePlugins: [
      "@capacitor-community/bluetooth-le",
      "@capacitor/app",
      "@capacitor/splash-screen",
      "@capacitor/status-bar",
      "@capawesome/capacitor-app-update",
      "@capgo/camera-preview",
      "@capgo/capacitor-wifi",
      "capacitor-native-settings"
    ],
    allowMixedContent: false,
    backgroundColor: '#060810',
  },
};

export default config;

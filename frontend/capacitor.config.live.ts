/**
 * Capacitor LIVE-RELOAD Konfiguration
 * 
 * Verwendung:
 *   cp capacitor.config.live.ts capacitor.config.ts
 *   npx cap sync
 *   npx cap run android   (oder ios)
 * 
 * Die App lädt direkt von der angegebenen URL und reflektiert
 * Änderungen am Web-Code in Echtzeit (kein build+sync nötig).
 * 
 * Vor dem Release: zurück zur statischen Production-Config:
 *   git checkout capacitor.config.ts
 *   yarn build && npx cap sync
 */
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bidblitz.app',
  appName: 'BidBlitz',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    url: 'https://super-app-staging-2.preview.emergentagent.com',
    cleartext: true,
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
  },
  ios: { contentInset: 'always', backgroundColor: '#060810' },
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

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
  appId: 'com.bidblitz.pos',
  appName: 'BidBlitz',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    url: 'https://bidblitz-release.preview.emergentagent.com',
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
  android: { allowMixedContent: false, backgroundColor: '#060810' },
};

export default config;

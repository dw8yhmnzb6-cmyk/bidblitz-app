import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bidblitz.pos',
  appName: 'BidBlitz',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    // For LIVE preview (development) you may set:
    // url: 'https://kassensystem-preview.preview.emergentagent.com',
    // cleartext: true,
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
  ios: {
    contentInset: 'always',
    backgroundColor: '#060810',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#060810',
  },
};

export default config;

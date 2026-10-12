import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dawertech.inventory',
  appName: 'DawerTech',
  webDir: 'www/browser',
  server: { androidScheme: 'https', cleartext: true },
  android: { allowMixedContent: true },
};

export default config;

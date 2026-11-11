import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.noto.mobile',
  appName: 'Noto',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: { LocalNotifications: { smallIcon: 'ic_launcher_foreground' } },
};
export default config;

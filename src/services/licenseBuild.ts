import Constants from 'expo-constants';

// Embedded by app.config.js. No account flag, network response or persistent override.
export const testLicenseBypass = Constants.expoConfig?.extra?.appEnvironment === 'homologation'
  && Constants.expoConfig?.extra?.testLicenseBypass === true;

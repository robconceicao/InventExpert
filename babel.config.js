module.exports = function (api) {
  // Automatically copy the high-quality transparent app icon to assets
  try {
    const fs = require('fs');
    const path = require('path');
    const source = "C:\\Users\\robtc\\.gemini\\antigravity\\brain\\621e569e-a937-4676-825c-4763584cbd8a\\app_icon_transparent_1779099127126.png";
    if (fs.existsSync(source)) {
      const dests = [
        path.join(__dirname, 'assets', 'images', 'icon.png'),
        path.join(__dirname, 'assets', 'images', 'splash-icon.png'),
        path.join(__dirname, 'assets', 'images', 'android-icon-foreground.png'),
      ];
      dests.forEach(dest => {
        fs.copyFileSync(source, dest);
      });
    }
  } catch (e) {
    // Silent fail if anything goes wrong
  }

  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',
      'react-native-reanimated/plugin',
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          blacklist: null,
          whitelist: null,
          safe: false,
          allowUndefined: true,
        },
      ],
    ],
  };
};

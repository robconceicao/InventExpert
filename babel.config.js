module.exports = function (api) {
  api.cache.using(() => {
    try {
      return require('fs').readFileSync(
        require('path').resolve(__dirname, '.env'),
        'utf8'
      );
    } catch {
      return '';
    }
  });
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
          // Chave ausente vira undefined em vez de quebrar o bundle.
          // handwritingEraser trata cada chave como opcional; com false,
          // um deploy web (sem .env) derrubava o build inteiro.
          allowUndefined: true,
        },
      ],
    ],
  };
};

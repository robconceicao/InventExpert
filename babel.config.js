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
          // handwritingEraser importa 4 chaves de IA e trata cada uma como
          // opcional (`if (CHAVE && CHAVE !== "sua_chave_...")` = motor
          // indisponível). Com false, um .env sem OPENAI/GROQ derrubava o
          // build inteiro no bundle — inclusive o deploy web, que não gera
          // .env nenhum.
          allowUndefined: true,
        },
      ],
    ],
  };
};

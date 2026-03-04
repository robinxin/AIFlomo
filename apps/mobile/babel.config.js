module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './',
            '@/components': './components',
            '@/lib': './lib',
            '@/context': './context',
            '@/hooks': './hooks',
            '@/assets': './assets',
          },
        },
      ],
    ],
  };
};

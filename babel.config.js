module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
        shippedProposals: true,
      },
    ],
  ],
  plugins: ['@babel/plugin-proposal-class-properties'],
};

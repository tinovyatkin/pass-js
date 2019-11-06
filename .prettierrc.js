module.exports = {
  endOfLine: 'lf',
  semi: true,
  singleQuote: true,
  arrowParens: 'avoid',
  bracketSpacing: true,
  quoteProps: 'as-needed',
  trailingComma: 'all',
  useTabs: false,
  overrides: [
    {
      files: '*.ts',
      // force our version of typescript-estree
      options: { parser: require('@typescript-eslint/typescript-estree') },
    },
  ],
};

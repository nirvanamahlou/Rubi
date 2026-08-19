import baseConfig from './base.mjs';

export default [
  ...baseConfig,
  {
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];

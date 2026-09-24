import nextConfig from '@nora/eslint-config/next';

const config = [
  {
    ignores: ['public/package-generator/**'],
  },
  ...nextConfig,
];

export default config;

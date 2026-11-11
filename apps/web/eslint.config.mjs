import nextConfig from '@nora/eslint-config/next';

const config = [
  {
    ignores: ['public/package-generator/**'],
  },
  ...nextConfig,
  {
    files: ['src/lib/{auth-session,authenticated-fetch}.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': [
        'error',
        { ignoreVoid: false },
      ],
    },
  },
];

export default config;

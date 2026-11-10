import nestConfig from '@nora/eslint-config/nest';

export default [
  ...nestConfig,
  {
    files: [
      'src/iam/auth.guard.ts',
      'src/documents/document-scan-worker.ts',
      'src/reporting/reporting-export.{service,worker}.ts',
    ],
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

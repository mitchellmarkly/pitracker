export default [
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];

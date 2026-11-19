/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  passWithNoTests: false,
  preset: 'jest-expo',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts', '<rootDir>/__tests__/**/*.test.tsx'],
};

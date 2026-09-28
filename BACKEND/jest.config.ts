import type { Config } from 'jest';

const config: Config = {
  // TypeScript files ko compile karke run karne ke liye ts-jest preset
  preset: 'ts-jest',

  // Backend / Node.js environment define karna
  testEnvironment: 'node',

  // Jest ko batana ki test files kahan dhoondhni hain
  testMatch: ['**/tests/**/*.test.ts'],

  // Test run hone par detailed logs aur status print karna
  verbose: true,

  // Async tasks aur open handles khatam hone ke baad test process clean exit kare
  forceExit: true,

  // Har test se pehle mocks ko auto clean aur restore karna
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // ESM / NodeNext imports compatibility
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
};

export default config;
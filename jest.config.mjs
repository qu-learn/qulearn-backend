export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.mts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.mts$': '$1',
  },
  transform: {
    '^.+\\.mts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  globalSetup: '<rootDir>/tests/setup/globalSetup.mts',
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.mts',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/testSetup.mts'],
  testMatch: ['**/*.test.mts'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.mts',
    '!src/**/*.d.ts',
    '!src/server.mts',
  ],
};

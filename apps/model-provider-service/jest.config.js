/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  clearMocks: true,
  // A workspace-local moduleNameMapper for `cockatiel` used to be
  // needed here (a nested apps/model-provider-service/node_modules/cockatiel
  // shadowed the root copy, and this forced resolution to the CJS
  // build). npm workspaces now hoist a single CJS-compatible
  // cockatiel@3.2.1 to the repo root (see package-lock.json), so
  // there is nothing left to disambiguate — removed rather than left
  // pointing at a path that no longer exists.
};

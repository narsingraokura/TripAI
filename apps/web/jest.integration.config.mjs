import nextJest from "next/jest.js"

const createJestConfig = nextJest({ dir: "./" })

export default createJestConfig({
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.integration.test.*"],
  setupFiles: ["<rootDir>/jest.integration.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
})

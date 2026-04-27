/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-unresolvable",
      severity: "error",
      comment: "Imports must resolve in the local TypeScript/Next.js project.",
      from: {},
      to: {
        couldNotResolve: true,
      },
    },
    {
      name: "lib-and-utils-must-not-import-app",
      severity: "error",
      comment: "Shared business logic should not depend on route/UI modules.",
      from: {
        path: "^(lib|utils)/",
      },
      to: {
        path: "^app/",
      },
    },
    {
      name: "production-code-must-not-import-tests",
      severity: "error",
      comment: "App, library, utility, and script code should not depend on test files.",
      from: {
        path: "^(app|lib|utils|scripts)/",
      },
      to: {
        path: "^tests/",
      },
    },
    {
      name: "no-circular-dependencies",
      severity: "warn",
      comment: "Circular dependencies make refactors and server/client boundaries harder to reason about.",
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: [
        "^\\.next/",
        "^coverage/",
        "^playwright-report/",
        "^test-results/",
        "^lib/affiliate/lazada-feed-data\\.generated\\.json$",
      ].join("|"),
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};

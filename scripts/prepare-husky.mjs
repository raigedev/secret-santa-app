import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync(".git")) {
  process.exit(0);
}

let gitExecutable = "git";

if (process.platform === "win32") {
  const knownGitPaths = [
    "C:\\Program Files\\Git\\cmd\\git.exe",
    "C:\\Program Files\\Git\\bin\\git.exe",
    "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
    "C:\\Program Files (x86)\\Git\\bin\\git.exe",
  ];

  // The candidate paths come from a fixed allowlist, not user input.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const resolvedGit = knownGitPaths.find((candidate) => existsSync(candidate));

  if (!resolvedGit) {
    console.log("Skipping git hook setup: git was not found on PATH.");
    process.exit(0);
  }

  gitExecutable = resolvedGit;
}

const result = spawnSync(gitExecutable, ["config", "core.hooksPath", ".husky"], {
  stdio: "inherit",
});

if (result.status && result.status !== 0) {
  process.exit(result.status);
}

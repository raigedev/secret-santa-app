/* eslint-disable security/detect-non-literal-fs-filename -- Local diagnostics scanner reads source files from fixed repo roots. */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const npxCommand = isWindows ? "npx.cmd" : "npx";
const sourceRoots = ["app", "lib", "utils", "tests"];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const ignoredDirectoryNames = new Set([".next", "node_modules", "playwright-report", "test-results"]);

const spacingScale = new Map([
  ["0.5rem", "2"],
  ["0.75rem", "3"],
  ["1rem", "4"],
  ["1.25rem", "5"],
  ["1.5rem", "6"],
  ["1.75rem", "7"],
  ["2rem", "8"],
  ["2.25rem", "9"],
  ["2.5rem", "10"],
  ["2.75rem", "11"],
  ["3rem", "12"],
  ["3.5rem", "14"],
  ["4rem", "16"],
  ["5rem", "20"],
  ["6rem", "24"],
  ["7rem", "28"],
  ["8rem", "32"],
  ["9rem", "36"],
  ["10rem", "40"],
  ["11rem", "44"],
  ["12rem", "48"],
]);

const roundedScale = new Map([
  ["1.5rem", "rounded-3xl"],
  ["2rem", "rounded-4xl"],
]);

function runCommand(label, command, args) {
  console.log(`\n== ${label} ==`);
  const commandLine = isWindows
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] }
    : { command, args };
  const result = spawnSync(commandLine.command, commandLine.args, {
    cwd: process.cwd(),
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Failed to start ${label}: ${result.error.message}`);
    process.exitCode = 1;
    return false;
  }

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    return false;
  }

  return true;
}

function collectFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (!ignoredDirectoryNames.has(entry)) {
        files.push(...collectFiles(fullPath));
      }
      continue;
    }

    if (stats.isFile() && sourceExtensions.has(path.extname(entry))) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineNumberForOffset(content, offset) {
  let line = 1;

  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) {
      line += 1;
    }
  }

  return line;
}

function reportProblem(problems, file, content, offset, found, message) {
  problems.push({
    file,
    found,
    line: lineNumberForOffset(content, offset),
    message,
  });
}

function checkTailwindCanonicalClasses() {
  console.log("\n== Tailwind VS Code Problems pattern scan ==");
  const files = sourceRoots.flatMap((root) => collectFiles(root));
  const problems = [];

  for (const file of files) {
    const content = readFileSync(file, "utf8");

    for (const match of content.matchAll(/\bbg-\[length:([^\]]+)\]/g)) {
      reportProblem(
        problems,
        file,
        content,
        match.index || 0,
        match[0],
        `Use bg-size-[${match[1]}] instead.`,
      );
    }

    for (const match of content.matchAll(/\bbg-\[(?:radial|linear)-gradient\([^\]]*_,[^\]]*\]/g)) {
      reportProblem(
        problems,
        file,
        content,
        match.index || 0,
        match[0],
        "Remove redundant underscore separators or move complex gradients to a style backgroundImage.",
      );
    }

    for (const match of content.matchAll(/\b(left|right|top|bottom)-\[-([0-9.]+rem)\]/g)) {
      const canonicalValue = spacingScale.get(match[2]);

      if (canonicalValue) {
        reportProblem(
          problems,
          file,
          content,
          match.index || 0,
          match[0],
          `Use -${match[1]}-${canonicalValue} instead.`,
        );
      }
    }

    for (const match of content.matchAll(/\brounded-\[([0-9.]+rem)\]/g)) {
      const canonicalClass = roundedScale.get(match[1]);

      if (canonicalClass) {
        reportProblem(
          problems,
          file,
          content,
          match.index || 0,
          match[0],
          `Use ${canonicalClass} instead.`,
        );
      }
    }
  }

  if (problems.length === 0) {
    console.log("No known Tailwind VS Code Problems patterns found.");
    return true;
  }

  for (const problem of problems) {
    console.error(`${problem.file}:${problem.line}`);
    console.error(`  ${problem.found}`);
    console.error(`  ${problem.message}`);
  }

  process.exitCode = 1;
  return false;
}

let ok = true;

ok = checkTailwindCanonicalClasses() && ok;
ok = runCommand("TypeScript", npmCommand, ["run", "typecheck"]) && ok;
ok = runCommand("ESLint security", npmCommand, ["run", "lint:security"]) && ok;
ok = runCommand("cSpell", npxCommand, ["--yes", "cspell@8", "--no-progress", "."]) && ok;

if (!ok) {
  console.error("\nVS Code Problems-style checks failed. Fix the reported diagnostics before finishing.");
  process.exit(process.exitCode || 1);
}

console.log("\nVS Code Problems-style checks passed.");

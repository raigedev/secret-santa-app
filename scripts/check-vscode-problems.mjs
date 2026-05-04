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
const supabaseConfigPath = path.join("supabase", "config.toml");
const supabaseMigrationsPath = path.join("supabase", "migrations");

const roundedScale = new Map([
  ["2px", "sm"],
  ["0.125rem", "sm"],
  ["4px", ""],
  ["0.25rem", ""],
  ["6px", "md"],
  ["0.375rem", "md"],
  ["8px", "lg"],
  ["0.5rem", "lg"],
  ["12px", "xl"],
  ["0.75rem", "xl"],
  ["16px", "2xl"],
  ["1rem", "2xl"],
  ["24px", "3xl"],
  ["1.5rem", "3xl"],
  ["32px", "4xl"],
  ["2rem", "4xl"],
]);

const spacingUtilities = new Set([
  "max-h",
  "max-w",
  "min-h",
  "min-w",
  "inset-x",
  "inset-y",
  "space-x",
  "space-y",
  "gap-x",
  "gap-y",
  "bottom",
  "right",
  "left",
  "top",
  "inset",
  "size",
  "gap",
  "h",
  "w",
  "px",
  "py",
  "pt",
  "pr",
  "pb",
  "pl",
  "p",
  "mx",
  "my",
  "mt",
  "mr",
  "mb",
  "ml",
  "m",
]);
const roundedUtilities = new Set([
  "rounded",
  "rounded-t",
  "rounded-r",
  "rounded-b",
  "rounded-l",
  "rounded-s",
  "rounded-e",
  "rounded-x",
  "rounded-y",
  "rounded-tl",
  "rounded-tr",
  "rounded-br",
  "rounded-bl",
]);
const plainNumberUtilities = new Set(["z"]);
const classDelimiters = new Set([" ", "\t", "\r", "\n", "\"", "'", "`", "<", ">", "{", "}", "(", ")", ","]);

function isClassDelimiter(character) {
  return character === undefined || classDelimiters.has(character);
}

function isNumericLiteral(value) {
  if (value.length === 0) {
    return false;
  }

  let decimalCount = 0;

  for (const character of value) {
    if (character === ".") {
      decimalCount += 1;

      if (decimalCount > 1) {
        return false;
      }

      continue;
    }

    const characterCode = character.charCodeAt(0);
    if (characterCode < 48 || characterCode > 57) {
      return false;
    }
  }

  return true;
}

function canonicalSpacingClass(prefix, utility, amount, unit) {
  const numericValue = Number.parseFloat(amount);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  const scaleValue = unit === "px" ? numericValue / 4 : numericValue * 4;
  const nearestHalfStep = Math.round(scaleValue * 2) / 2;

  if (Math.abs(scaleValue - nearestHalfStep) > 0.000_001) {
    return null;
  }

  const scaleText = Number.isInteger(nearestHalfStep)
    ? String(nearestHalfStep)
    : String(nearestHalfStep);

  return `${prefix}${utility}-${scaleText}`;
}

function canonicalRoundedClass(prefix, utility, amount, unit) {
  const roundedValue = roundedScale.get(`${amount}${unit}`);

  if (roundedValue === undefined) {
    return null;
  }

  if (roundedValue.length === 0) {
    return `${prefix}${utility}`;
  }

  return `${prefix}${utility}-${roundedValue}`;
}

function canonicalPlainNumberClass(prefix, utility, amount) {
  return `${prefix}${utility}-${amount}`;
}

function classTokenAt(content, markerOffset) {
  let start = markerOffset;
  let end = markerOffset;

  while (start > 0 && !isClassDelimiter(content[start - 1])) {
    start -= 1;
  }

  while (end < content.length && !isClassDelimiter(content[end])) {
    end += 1;
  }

  return {
    start,
    token: content.slice(start, end),
  };
}

function parseArbitraryClassToken(token) {
  const marker = token.indexOf("-[");

  if (marker <= 0 || !token.endsWith("]")) {
    return null;
  }

  const value = token.slice(marker + 2, -1);
  const unit = value.endsWith("px") ? "px" : value.endsWith("rem") ? "rem" : "";
  const amount = unit.length > 0 ? value.slice(0, -unit.length) : value;

  if (!isNumericLiteral(amount)) {
    return null;
  }

  const prefixAndUtility = token.slice(0, marker);
  const variantIndex = prefixAndUtility.lastIndexOf(":");
  const prefix = variantIndex === -1 ? "" : prefixAndUtility.slice(0, variantIndex + 1);
  const utility = variantIndex === -1 ? prefixAndUtility : prefixAndUtility.slice(variantIndex + 1);

  return {
    amount,
    prefix,
    unit,
    utility,
  };
}

function containsClassToken(line, token) {
  let index = line.indexOf(token);

  while (index !== -1) {
    const before = line[index - 1];
    const after = line[index + token.length];

    if (isClassDelimiter(before) && isClassDelimiter(after)) {
      return true;
    }

    index = line.indexOf(token, index + token.length);
  }

  return false;
}

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
    let arbitraryClassOffset = 0;

    while (arbitraryClassOffset < content.length) {
      const markerOffset = content.indexOf("-[", arbitraryClassOffset);

      if (markerOffset === -1) {
        break;
      }

      const { start, token } = classTokenAt(content, markerOffset);

      if (token.startsWith("bg-[length:") && token.endsWith("]")) {
        const backgroundSize = token.slice("bg-[length:".length, -1);
        reportProblem(
          problems,
          file,
          content,
          start,
          token,
          `Use bg-size-[${backgroundSize}] instead.`,
        );
      }

      if (
        (token.startsWith("bg-[radial-gradient(") || token.startsWith("bg-[linear-gradient(")) &&
        token.includes("_,")
      ) {
        reportProblem(
          problems,
          file,
          content,
          start,
          token,
          "Remove redundant underscore separators or move complex gradients to a style backgroundImage.",
        );
      }

      const arbitraryClass = parseArbitraryClassToken(token);

      if (arbitraryClass) {
        const spacingUtility = arbitraryClass.utility.startsWith("-")
          ? arbitraryClass.utility.slice(1)
          : arbitraryClass.utility;

        if (spacingUtilities.has(spacingUtility)) {
          const canonicalClass = canonicalSpacingClass(
            arbitraryClass.prefix,
            arbitraryClass.utility,
            arbitraryClass.amount,
            arbitraryClass.unit,
          );

          if (canonicalClass) {
            reportProblem(
              problems,
              file,
              content,
              start,
              token,
              `Use ${canonicalClass} instead.`,
            );
          }
        }

        if (roundedUtilities.has(arbitraryClass.utility)) {
          if (arbitraryClass.unit.length === 0) {
            arbitraryClassOffset = markerOffset + 2;
            continue;
          }

          const canonicalClass = canonicalRoundedClass(
            arbitraryClass.prefix,
            arbitraryClass.utility,
            arbitraryClass.amount,
            arbitraryClass.unit,
          );

          if (canonicalClass) {
            reportProblem(
              problems,
              file,
              content,
              start,
              token,
              `Use ${canonicalClass} instead.`,
            );
          }
        }

        const numericUtility = arbitraryClass.utility.startsWith("-")
          ? arbitraryClass.utility.slice(1)
          : arbitraryClass.utility;

        if (arbitraryClass.unit.length === 0 && plainNumberUtilities.has(numericUtility)) {
          reportProblem(
            problems,
            file,
            content,
            start,
            token,
            `Use ${canonicalPlainNumberClass(
              arbitraryClass.prefix,
              arbitraryClass.utility,
              arbitraryClass.amount,
            )} instead.`,
          );
        }
      }

      arbitraryClassOffset = markerOffset + 2;
    }

    let lineStartOffset = 0;
    for (const line of content.split("\n")) {
      const hasBaseOutline = containsClassToken(line, "focus-visible:outline");
      const hasOutlineWidth = containsClassToken(line, "focus-visible:outline-2");

      if (hasBaseOutline && hasOutlineWidth) {
        reportProblem(
          problems,
          file,
          content,
          lineStartOffset + line.indexOf("focus-visible:outline"),
          "focus-visible:outline focus-visible:outline-2",
          "Remove duplicate focus-visible:outline; focus-visible:outline-2 already sets the outline width.",
        );
      }

      lineStartOffset += line.length + 1;
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

function checkSupabaseMigrationCliSafety() {
  console.log("\n== Supabase migration CLI safety scan ==");
  const problems = [];

  if (existsSync(supabaseMigrationsPath)) {
    const migrationFiles = readdirSync(supabaseMigrationsPath)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => path.join(supabaseMigrationsPath, file));

    for (const file of migrationFiles) {
      const content = readFileSync(file, "utf8");
      const concurrentIndexPattern = /\b(?:create|drop)\s+index\s+concurrently\b/gi;
      let match = concurrentIndexPattern.exec(content);

      while (match) {
        reportProblem(
          problems,
          file,
          content,
          match.index,
          match[0],
          "Do not use CONCURRENTLY in committed Supabase migrations; run production-only one-statement index operations manually when needed.",
        );
        match = concurrentIndexPattern.exec(content);
      }
    }
  }

  if (existsSync(supabaseConfigPath)) {
    const content = readFileSync(supabaseConfigPath, "utf8");
    let inMigrationsSection = false;
    let lineStartOffset = 0;

    for (const line of content.split("\n")) {
      const trimmedLine = line.trim();

      if (trimmedLine === "[db.migrations]") {
        inMigrationsSection = true;
      } else if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
        inMigrationsSection = false;
      } else if (inMigrationsSection && /^enabled\s*=\s*false\b/.test(trimmedLine)) {
        reportProblem(
          problems,
          supabaseConfigPath,
          content,
          lineStartOffset + line.indexOf("enabled"),
          trimmedLine,
          "Keep db.migrations.enabled = true so Supabase dry-runs do not silently skip pending migrations.",
        );
      }

      lineStartOffset += line.length + 1;
    }
  }

  if (problems.length === 0) {
    console.log("No Supabase migration CLI safety problems found.");
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
ok = checkSupabaseMigrationCliSafety() && ok;
ok = runCommand("TypeScript", npmCommand, ["run", "typecheck"]) && ok;
ok = runCommand("ESLint security", npmCommand, ["run", "lint:security"]) && ok;
ok = runCommand("cSpell", npxCommand, ["--yes", "cspell@8", "--no-progress", "."]) && ok;

if (!ok) {
  console.error("\nVS Code Problems-style checks failed. Fix the reported diagnostics before finishing.");
  process.exit(process.exitCode || 1);
}

console.log("\nVS Code Problems-style checks passed.");

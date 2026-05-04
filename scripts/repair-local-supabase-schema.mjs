import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

// cspell:ignore tablename

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const PUBLIC_SCHEMA_PATH = join("supabase", "public-schema.sql");
const MIGRATIONS_DIR = join("supabase", "migrations");
const LATER_MIGRATION_START = "202604060001";
const RLS_POLICY_MIGRATION_VERSION = "202604300003";

const LOCAL_COMPAT_SQL = `
do $$
begin
  if to_regclass('public.notifications') is not null
    and not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'notifications'
        and policyname = 'notifications_insert_for_owner'
    ) then
    create policy notifications_insert_for_owner
      on public.notifications
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end;
$$;
`;

function readDotEnv() {
  if (!existsSync(".env.local")) {
    return new Map();
  }

  const values = new Map();

  for (const rawLine of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    values.set(key, value);
  }

  return values;
}

function assertLocalSupabase(values) {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || values.get("NEXT_PUBLIC_SUPABASE_URL");

  if (!rawUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local.");
  }

  const url = new URL(rawUrl);

  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("Refusing to repair schema because NEXT_PUBLIC_SUPABASE_URL is not local.");
  }
}

function getProjectId() {
  if (!existsSync("supabase/config.toml")) {
    return basename(process.cwd());
  }

  const match = /^project_id\s*=\s*"([^"]+)"/m.exec(
    readFileSync("supabase/config.toml", "utf8")
  );

  return match?.[1] || basename(process.cwd());
}

function runDockerPsql(containerName, input, label, quiet = false) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      ...(quiet ? ["-q", "-t", "-A"] : []),
    ],
    {
      encoding: "utf8",
      input,
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  if (result.error || result.status !== 0) {
    const output = `${result.stderr || ""}${result.stdout || ""}`.trim();
    throw new Error(`${label} failed. ${output || result.error?.message || ""}`.trim());
  }

  return result.stdout.trim();
}

function assertDockerContainerExists(containerName) {
  try {
    execFileSync("docker", ["inspect", containerName], {
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch {
    throw new Error(
      `Local Supabase database container ${containerName} is not running. Start it with npx.cmd supabase start.`
    );
  }
}

function hasAppSchema(containerName) {
  return runDockerPsql(
    containerName,
    "select to_regclass('public.groups') is not null;",
    "Check local schema",
    true
  )
    .split(/\r?\n/)
    .some((line) => line.trim() === "t");
}

function applySqlFile(containerName, path) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path is restricted to repo-local Supabase schema or migration files.
  runDockerPsql(containerName, readFileSync(path, "utf8"), `Apply ${path}`, true);
}

function applyLaterMigrations(containerName) {
  const migrationNames = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql") && name >= LATER_MIGRATION_START)
    .sort();

  for (const migrationName of migrationNames) {
    if (migrationName.startsWith(RLS_POLICY_MIGRATION_VERSION)) {
      runDockerPsql(containerName, LOCAL_COMPAT_SQL, "Apply local notification policy compatibility");
    }

    applySqlFile(containerName, join(MIGRATIONS_DIR, migrationName));
  }
}

function repairLocalSchema() {
  const values = readDotEnv();
  assertLocalSupabase(values);

  const containerName = `supabase_db_${getProjectId()}`;
  assertDockerContainerExists(containerName);

  if (!hasAppSchema(containerName)) {
    if (!existsSync(PUBLIC_SCHEMA_PATH)) {
      throw new Error(
        `Local app schema is missing and ${PUBLIC_SCHEMA_PATH} is not available. Pull or recreate the local schema before seeding Playwright data.`
      );
    }

    applySqlFile(containerName, PUBLIC_SCHEMA_PATH);
  }

  applyLaterMigrations(containerName);
  console.log("Local Supabase schema is ready for Playwright data.");
}

repairLocalSchema();

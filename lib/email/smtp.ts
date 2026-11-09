import "server-only";

import nodemailer from "nodemailer";

type SmtpConfig = {
  from: string;
  host: string;
  pass: string;
  port: number;
  secure: boolean;
  user: string;
};

type SmtpConfigReadResult = {
  config: SmtpConfig | null;
  invalidPort: boolean;
  missingKeys: string[];
};

const DEFAULT_SMTP_PORT = 465;
const DEFAULT_SENDER_NAME = "My Secret Santa";

function readTrimmedEnv(name: string): string {
  return process.env[name]?.trim() || "";
}

function normalizeSmtpPassword(host: string, password: string): string {
  if (host.toLowerCase() === "smtp.gmail.com") {
    // Gmail app passwords are displayed in groups; SMTP auth expects the compact token.
    return password.replace(/\s+/g, "");
  }

  return password;
}

export function readSmtpConfig(): SmtpConfigReadResult {
  const host = readTrimmedEnv("SMTP_HOST");
  const user = readTrimmedEnv("SMTP_USER");
  const rawPass =
    readTrimmedEnv("SMTP_PASSWORD") ||
    readTrimmedEnv("SMTP_PASS") ||
    readTrimmedEnv("GMAIL_APP_PASSWORD");
  const pass = normalizeSmtpPassword(host, rawPass);
  const rawPort = readTrimmedEnv("SMTP_PORT");
  const port = rawPort ? Number(rawPort) : DEFAULT_SMTP_PORT;
  const invalidPort = !Number.isInteger(port) || port < 1 || port > 65535;
  const senderName =
    readTrimmedEnv("SMTP_FROM_NAME") ||
    readTrimmedEnv("EMAIL_FROM_NAME") ||
    DEFAULT_SENDER_NAME;
  const explicitFrom =
    readTrimmedEnv("SMTP_FROM") ||
    readTrimmedEnv("EMAIL_FROM") ||
    readTrimmedEnv("SMTP_FROM_EMAIL");
  const from = explicitFrom || `${senderName} <${user}>`;
  const missingKeys = [
    !host ? "SMTP_HOST" : null,
    !user ? "SMTP_USER" : null,
    !rawPass ? "SMTP_PASSWORD" : null,
  ].filter(Boolean) as string[];

  if (missingKeys.length > 0 || !pass || !from || invalidPort) {
    return { config: null, invalidPort, missingKeys };
  }

  return {
    config: {
      from,
      host,
      pass,
      port,
      secure: readTrimmedEnv("SMTP_SECURE") === "true" || port === DEFAULT_SMTP_PORT,
      user,
    },
    invalidPort,
    missingKeys,
  };
}

export function createSmtpTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    auth: {
      pass: config.pass,
      user: config.user,
    },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    host: config.host,
    port: config.port,
    requireTLS: process.env.NODE_ENV === "production" && !config.secure,
    secure: config.secure,
    socketTimeout: 10_000,
  });
}

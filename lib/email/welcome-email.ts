import "server-only";

import nodemailer from "nodemailer";
import { recordServerFailure } from "@/lib/security/audit";
import { sanitizePlainText } from "@/lib/validation/common";

type WelcomeEmailInput = {
  dashboardUrl: string;
  displayName?: string | null;
  email: string;
  userId: string;
};

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

type WelcomeEmailResult = "failed" | "sent" | "skipped";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_ADDRESS_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
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

function readSmtpConfig(): SmtpConfigReadResult {
  const host = readTrimmedEnv("SMTP_HOST");
  const user = readTrimmedEnv("SMTP_USER");
  const rawPass =
    readTrimmedEnv("SMTP_PASSWORD") ||
    readTrimmedEnv("SMTP_PASS") ||
    readTrimmedEnv("GMAIL_APP_PASSWORD");
  const pass = normalizeSmtpPassword(host, rawPass);
  const rawPort = readTrimmedEnv("SMTP_PORT");
  const port = rawPort ? Number(rawPort) : DEFAULT_SMTP_PORT;
  const invalidPort = !Number.isInteger(port) || port <= 0;
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

function getGreetingName(displayName: string | null | undefined): string {
  const safeName = sanitizePlainText(displayName || "", 80);

  if (!safeName) {
    return "there";
  }

  return safeName.split(/\s+/)[0] || "there";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSafeEmailError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  return rawMessage.replace(EMAIL_ADDRESS_PATTERN, "[email]").slice(0, 500);
}

function buildWelcomeEmail(input: WelcomeEmailInput): { html: string; text: string } {
  const greetingName = getGreetingName(input.displayName);
  const safeGreetingName = escapeHtml(greetingName);
  const safeDashboardUrl = escapeHtml(input.dashboardUrl);

  return {
    html: `
      <div style="font-family: Arial, sans-serif; color: #24312b; line-height: 1.6; max-width: 560px;">
        <h1 style="font-size: 24px; margin: 0 0 16px;">Welcome to My Secret Santa</h1>
        <p>Hi ${safeGreetingName},</p>
        <p>Your account is ready. You can create a group, add wishlist ideas, or open any invites waiting on your dashboard.</p>
        <p style="margin: 24px 0;">
          <a href="${safeDashboardUrl}" style="background: #48664e; color: #ffffff; padding: 12px 18px; border-radius: 999px; text-decoration: none; font-weight: 700;">
            Open your dashboard
          </a>
        </p>
        <p style="color: #5b605e; font-size: 14px;">If the button does not work, open this link: ${safeDashboardUrl}</p>
      </div>
    `,
    text: [
      `Hi ${greetingName},`,
      "",
      "Welcome to My Secret Santa. Your account is ready.",
      "Create a group, add wishlist ideas, or open any invites waiting on your dashboard.",
      "",
      `Open your dashboard: ${input.dashboardUrl}`,
    ].join("\n"),
  };
}

export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<WelcomeEmailResult> {
  const { config, invalidPort, missingKeys } = readSmtpConfig();
  const email = input.email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    await recordServerFailure({
      actorUserId: input.userId,
      errorMessage: "Welcome email skipped because the recipient address was missing or invalid",
      eventType: "email.welcome.invalid_recipient",
      resourceId: input.userId,
      resourceType: "email",
    });

    return "skipped";
  }

  if (!config) {
    await recordServerFailure({
      actorUserId: input.userId,
      details: {
        invalidPort,
        missingKeys,
      },
      errorMessage: "Welcome email skipped because SMTP configuration is incomplete",
      eventType: "email.welcome.config_missing",
      resourceId: input.userId,
      resourceType: "email",
    });

    return "skipped";
  }

  const transport = nodemailer.createTransport({
    auth: {
      pass: config.pass,
      user: config.user,
    },
    host: config.host,
    port: config.port,
    secure: config.secure,
  });
  const message = buildWelcomeEmail(input);

  try {
    await transport.sendMail({
      from: config.from,
      html: message.html,
      subject: "Welcome to My Secret Santa",
      text: message.text,
      to: email,
    });

    return "sent";
  } catch (error) {
    await recordServerFailure({
      actorUserId: input.userId,
      details: {
        smtpHost: config.host,
        smtpPort: config.port,
      },
      errorMessage: getSafeEmailError(error),
      eventType: "email.welcome.send",
      resourceId: input.userId,
      resourceType: "email",
    });

    return "failed";
  }
}

import "server-only";

import nodemailer from "nodemailer";
import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
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

function getEmailAssetUrl(baseUrl: string, path: string): string {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return "";
  }
}

function getSafeEmailError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  return rawMessage.replace(EMAIL_ADDRESS_PATTERN, "[email]").slice(0, 500);
}

function buildWelcomeEmail(input: WelcomeEmailInput): { html: string; text: string } {
  const greetingName = getGreetingName(input.displayName);
  const safeGreetingName = escapeHtml(greetingName);
  const safeDashboardUrl = escapeHtml(input.dashboardUrl);
  const safeLogoUrl = escapeHtml(getEmailAssetUrl(input.dashboardUrl, "/secret-santa-logo.png"));

  return {
    html: `
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        Your My Secret Santa account is ready. Start a group, add wishlist ideas, or check invites from your dashboard.
      </div>
      <div style="margin:0;padding:0;background:#f9faf8;font-family:Nunito,Arial,Helvetica,sans-serif;color:#2e3432;">
        <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" style="background:#f9faf8;padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" style="max-width:620px;background:#fbfcfa;border:1px solid #e3e8df;border-radius:28px;overflow:hidden;box-shadow:0 24px 70px rgba(72,102,78,0.10);">
                <tr>
                  <td style="padding:28px 30px 16px 30px;background:#fbfcfa;">
                    <table role="presentation" width="100%" cellSpacing="0" cellPadding="0">
                      <tr>
                        <td width="72" valign="middle" style="width:72px;">
                          <img src="${safeLogoUrl}" width="58" height="58" alt="My Secret Santa" style="display:block;width:58px;height:58px;border:0;border-radius:18px;" />
                        </td>
                        <td valign="middle" style="padding-left:12px;">
                          <div style="font-size:14px;line-height:1.1;font-weight:800;color:#c0392b;">My Secret</div>
                          <div style="font-size:27px;line-height:1.05;font-weight:900;letter-spacing:-0.04em;color:#2e3432;">Santa</div>
                          <div style="font-size:10px;line-height:1.2;font-weight:800;font-style:italic;color:#c0392b;">shhh, it's a secret</div>
                        </td>
                        <td align="right" valign="middle" style="font-size:11px;line-height:1;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#7b5902;">
                          Account Ready
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 30px 0 30px;">
                    <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" style="background:#fff4cf;border:1px solid #ead99b;border-radius:26px;box-shadow:0 18px 44px rgba(123,89,2,0.12);">
                      <tr>
                        <td style="padding:28px 28px 24px 28px;">
                          <span style="display:inline-block;background:#fffdf8;border:1px solid rgba(123,89,2,0.16);border-radius:999px;padding:8px 12px;font-size:10px;line-height:1;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#7b5902;">
                            Welcome Gift Tag
                          </span>
                          <h1 style="margin:18px 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:1.08;font-weight:900;letter-spacing:-0.04em;color:#2e3432;">
                            Welcome in, ${safeGreetingName}.
                          </h1>
                          <p style="margin:0;color:#4f5d55;font-size:15px;line-height:1.65;font-weight:700;">
                            Your account is ready. Create a group, add wishlist ideas, or open any invites waiting on your dashboard.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px 30px 4px 30px;">
                    <table role="presentation" width="100%" cellSpacing="0" cellPadding="0">
                      <tr>
                        <td valign="top" style="padding:0 0 14px 0;">
                          <div style="font-size:13px;line-height:1.35;font-weight:900;color:#48664e;">Create a group</div>
                          <div style="margin-top:4px;font-size:13px;line-height:1.6;color:#64748b;">Set the gift date, budget, and members in one place.</div>
                        </td>
                      </tr>
                      <tr>
                        <td valign="top" style="padding:0 0 14px 0;">
                          <div style="font-size:13px;line-height:1.35;font-weight:900;color:#48664e;">Build your wishlist</div>
                          <div style="margin-top:4px;font-size:13px;line-height:1.6;color:#64748b;">Save helpful clues so your Santa has better gift ideas.</div>
                        </td>
                      </tr>
                      <tr>
                        <td valign="top" style="padding:0;">
                          <div style="font-size:13px;line-height:1.35;font-weight:900;color:#48664e;">Keep the surprise private</div>
                          <div style="margin-top:4px;font-size:13px;line-height:1.6;color:#64748b;">Draw details stay quiet until the group is ready.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding:28px 30px 18px 30px;">
                    <a href="${safeDashboardUrl}" style="display:inline-block;background:#48664e;color:#ffffff;text-decoration:none;font-size:16px;font-weight:900;padding:15px 30px;border-radius:999px;">
                      Open your dashboard
                    </a>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 30px 28px 30px;">
                    <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;text-align:center;">
                      If the button does not work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:10px 0 0 0;color:#48664e;font-size:12px;line-height:1.6;word-break:break-all;text-align:center;">
                      ${safeDashboardUrl}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:18px 30px;background:#f2f4f2;">
                    <p style="margin:0;color:#7a807a;font-size:12px;line-height:1.6;text-align:center;">
                      Sent by My Secret Santa. You can ignore this email if you did not create this account.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `,
    text: [
      `Hi ${greetingName},`,
      "",
      "Welcome to My Secret Santa. Your account is ready.",
      "Create a group, add wishlist ideas, or open any invites waiting on your dashboard.",
      "Your exchange details stay private until the group is ready.",
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

    try {
      await recordAuditEvent({
        actorUserId: input.userId,
        details: {
          smtpHost: config.host,
          smtpPort: config.port,
        },
        eventType: "email.welcome.sent",
        outcome: "success",
        resourceId: input.userId,
        resourceType: "email",
      });
    } catch {
      // The email already sent; audit availability must not change that result.
    }

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

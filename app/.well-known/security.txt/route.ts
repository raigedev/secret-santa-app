import { noStoreText } from "@/lib/security/no-store-response";
import { resolveTrustedAppOrigin } from "@/lib/security/app-origin";

const SECURITY_CONTACT_EMAIL = "mysecretsanta.notifications@gmail.com";
const SECURITY_TXT_MAX_AGE_DAYS = 180;

export const dynamic = "force-dynamic";

function getSecurityTxtExpiresAt(): string {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + SECURITY_TXT_MAX_AGE_DAYS);

  return expiresAt.toISOString();
}

export function GET() {
  const appOrigin = resolveTrustedAppOrigin(null);
  const body = [
    `Contact: mailto:${SECURITY_CONTACT_EMAIL}`,
    `Expires: ${getSecurityTxtExpiresAt()}`,
    `Policy: ${appOrigin}/privacy`,
    `Canonical: ${appOrigin}/.well-known/security.txt`,
    "Preferred-Languages: en",
    "",
  ].join("\n");

  return noStoreText(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

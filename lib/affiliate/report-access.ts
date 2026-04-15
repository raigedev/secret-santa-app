import "server-only";

export function getAffiliateReportAllowedEmails(): string[] {
  return (
    process.env.AFFILIATE_REPORT_ALLOWED_EMAILS ||
    process.env.AFFILIATE_REPORT_OWNER_EMAIL ||
    ""
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

export function canViewAffiliateReport(email: string | null | undefined): boolean {
  const allowedEmails = getAffiliateReportAllowedEmails();

  return Boolean(email) && allowedEmails.length > 0 && allowedEmails.includes(email!.toLowerCase());
}

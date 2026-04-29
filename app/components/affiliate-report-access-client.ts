const AFFILIATE_REPORT_ACCESS_STORAGE_KEY = "ss_ara";

function storeAffiliateReportAccess(allowed: boolean) {
  if (allowed) {
    sessionStorage.setItem(AFFILIATE_REPORT_ACCESS_STORAGE_KEY, "1");
  } else {
    sessionStorage.removeItem(AFFILIATE_REPORT_ACCESS_STORAGE_KEY);
  }
}

export function clearAffiliateReportAccess() {
  sessionStorage.removeItem(AFFILIATE_REPORT_ACCESS_STORAGE_KEY);
}

export async function fetchAffiliateReportAccess() {
  const response = await fetch("/api/affiliate/report-access", {
    credentials: "same-origin",
  });

  if (!response.ok) {
    storeAffiliateReportAccess(false);
    return false;
  }

  const payload = (await response.json()) as { allowed?: boolean };
  const allowed = payload.allowed === true;
  storeAffiliateReportAccess(allowed);
  return allowed;
}

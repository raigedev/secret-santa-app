import {
  readSessionStorageItem,
  removeSessionStorageItem,
  writeSessionStorageItem,
} from "@/lib/client-snapshot";

const AFFILIATE_REPORT_ACCESS_STORAGE_KEY = "ss_ara";

function storeAffiliateReportAccess(allowed: boolean) {
  if (allowed) {
    writeSessionStorageItem(AFFILIATE_REPORT_ACCESS_STORAGE_KEY, "1");
  } else {
    removeSessionStorageItem(AFFILIATE_REPORT_ACCESS_STORAGE_KEY);
  }
}

export function readStoredAffiliateReportAccess() {
  return readSessionStorageItem(AFFILIATE_REPORT_ACCESS_STORAGE_KEY) === "1";
}

export function clearAffiliateReportAccess() {
  removeSessionStorageItem(AFFILIATE_REPORT_ACCESS_STORAGE_KEY);
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

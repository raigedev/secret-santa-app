import { sanitizePlainText } from "@/lib/validation/common";

export const MAX_GROUP_MEMBERS = 26;
export const MAX_GROUP_INVITES_PER_SUBMISSION = 5;
const MAX_INVITE_EMAIL_LENGTH = 100;
export const MAX_INVITE_EMAIL_LIST_LENGTH =
  (MAX_INVITE_EMAIL_LENGTH + 2) * MAX_GROUP_INVITES_PER_SUBMISSION;
const MAX_GROUP_CREATION_INVITES = MAX_GROUP_MEMBERS - 1;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_LOCAL_PART = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const INVITE_DOMAIN_LABEL = /^[a-z0-9-]+$/i;

function isGroupInviteEmail(email: string): boolean {
  if (email.length > MAX_INVITE_EMAIL_LENGTH) return false;
  const [localPart, domain, extra] = email.split("@");
  if (extra !== undefined || !domain || !INVITE_LOCAL_PART.test(localPart)) return false;
  const labels = domain.split(".");
  return labels.length > 1 && labels.every((label) =>
    INVITE_DOMAIN_LABEL.test(label) && !label.startsWith("-") && !label.endsWith("-"),
  );
}

export function parseGroupInviteEmails(value: unknown): { addresses: string[]; error: string | null } {
  if (typeof value !== "string" || !value.trim()) {
    return { addresses: [], error: "Enter at least one email address." };
  }

  const limitMessage = `Enter up to ${MAX_GROUP_INVITES_PER_SUBMISSION} email addresses at a time.`;
  if (value.length > MAX_INVITE_EMAIL_LIST_LENGTH) return { addresses: [], error: limitMessage };

  const entries = value.split(",").map((email) => email.trim().toLowerCase());
  if (entries.length > MAX_GROUP_INVITES_PER_SUBMISSION) {
    return { addresses: [], error: limitMessage };
  }
  if (entries.some((email) => !isGroupInviteEmail(email))) {
    return { addresses: [], error: "Check each email address and separate them with commas." };
  }

  return { addresses: [...new Set(entries)], error: null };
}

export function getGroupCreationInvites(rawEmails: string[], ownerEmail?: string | null) {
  const organizerAddress = ownerEmail?.trim().toLowerCase();
  const addresses = new Set<string>();
  let includesOrganizer = false;

  for (const rawEmail of rawEmails) {
    const address = sanitizePlainText(rawEmail, 100).toLowerCase();
    if (organizerAddress && address === organizerAddress) {
      includesOrganizer = true;
    } else if (addresses.size < MAX_GROUP_CREATION_INVITES && EMAIL_PATTERN.test(address)) {
      addresses.add(address);
    }
  }

  return { addresses: [...addresses], includesOrganizer };
}

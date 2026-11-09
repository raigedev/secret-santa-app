import { sanitizePlainText } from "@/lib/validation/common";

export const MAX_GROUP_MEMBERS = 26;
const MAX_GROUP_CREATION_INVITES = MAX_GROUP_MEMBERS - 1;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

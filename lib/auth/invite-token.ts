export function isInviteTokenHash(value: string | null): value is string {
  // Supabase encodes invite tokens as SHA-224 hex digests.
  return value !== null && /^[a-f0-9]{56}$/i.test(value);
}

"use server";

// ─── Server Action for Create Group ───
// This runs on the SERVER, not the browser.
// We need this because sending invite emails requires the
// SUPABASE_SERVICE_ROLE_KEY (admin key), which must NEVER
// be exposed to the browser for security reasons.

import { supabaseAdmin } from "@/lib/supabase/server";

// ─── Send invite emails to a list of email addresses ───
// Called after a group is created successfully.
// Uses Supabase Admin to send "You've been invited" emails.
// If someone already has an account, they get a login link.
// If they don't have an account, they get a signup link.
export async function sendInviteEmails(
  emails: string[]
): Promise<{ sent: number; failed: string[] }> {
  // Track results so we can tell the user what happened
  let sent = 0;
  const failed: string[] = [];

  // Loop through each email and send an invite
  for (const email of emails) {
    // Skip empty strings (in case of trailing commas)
    if (!email || email.trim().length === 0) continue;

    // Send the invite email using the Supabase Admin client.
    // "inviteUserByEmail" sends an email with a magic link.
    // If the user already exists, it sends a login link instead.
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase()
    );

    if (error) {
      // Log the error but don't stop — try the next email
      console.error(`Failed to send invite to ${email}:`, error.message);
      failed.push(email);
    } else {
      sent++;
    }
  }

  return { sent, failed };
}
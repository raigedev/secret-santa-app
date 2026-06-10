import { loadPendingEmailInvitesForUser } from "@/lib/groups/pending-email-invites";
import { noStoreJson } from "@/lib/security/no-store-response";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return noStoreJson({ success: false, invites: [] });
  }

  const result = await loadPendingEmailInvitesForUser({
    email: user.email,
    id: user.id,
  });

  return noStoreJson(result);
}

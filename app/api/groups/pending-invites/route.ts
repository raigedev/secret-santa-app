import { isUserEmailVerified } from "@/lib/auth/user-status";
import { loadPendingInvitesForUser } from "@/lib/groups/pending-invites";
import { noStoreJson } from "@/lib/security/no-store-response";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isUserEmailVerified(user)) {
    return noStoreJson({ success: false, invites: [] });
  }

  const result = await loadPendingInvitesForUser({
    email: user.email,
    id: user.id,
  });

  return noStoreJson(result);
}

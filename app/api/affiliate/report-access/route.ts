import { canViewAffiliateReport } from "@/lib/affiliate/report-access";
import { noStoreJson } from "@/lib/security/no-store-response";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return noStoreJson({ allowed: false }, { status: 200 });
  }

  return noStoreJson({ allowed: canViewAffiliateReport(user.email) }, { status: 200 });
}

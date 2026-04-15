import { NextResponse } from "next/server";

import { canViewAffiliateReport } from "@/lib/affiliate/report-access";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ allowed: false }, { status: 200 });
  }

  return NextResponse.json({ allowed: canViewAffiliateReport(user.email) }, { status: 200 });
}

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ allowed: false }, { status: 200 });
  }

  const allowedEmails = (
    process.env.AFFILIATE_REPORT_ALLOWED_EMAILS ||
    process.env.AFFILIATE_REPORT_OWNER_EMAIL ||
    ""
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  const allowed =
    Boolean(user.email) &&
    allowedEmails.length > 0 &&
    allowedEmails.includes(user.email!.toLowerCase());

  return NextResponse.json({ allowed }, { status: 200 });
}

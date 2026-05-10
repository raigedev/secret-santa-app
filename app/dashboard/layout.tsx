import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getEmailVerificationMessage, isUserEmailVerified } from "@/lib/auth/user-status";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isUserEmailVerified(user)) {
    const params = new URLSearchParams({
      error: "confirm_email",
      message: getEmailVerificationMessage(),
    });

    redirect(`/login?${params.toString()}`);
  }

  return children;
}

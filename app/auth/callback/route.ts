import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

export async function GET(request: Request) {
  try {
    // Exchange the code for a session server-side
    const { error } = await supabase.auth.exchangeCodeForSession(request.url);

    if (error) {
      console.error("Auth callback error:", error.message);
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // ✅ Cookies are now set server-side
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
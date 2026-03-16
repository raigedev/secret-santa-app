import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: Request) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.headers.get("cookie")?.split(";")
            .map((c) => c.trim().split("="))
            .find(([k]) => k === name)?.[1];
        },
        set(name: string, value: string, options) {
          response.cookies.set(name, value, options);
        },
        remove(name: string, options) {
          response.cookies.set(name, "", options);
        },
      },
    }
  );

  const { data } = await supabase.auth.getSession();

  if (!data.session && request.url.includes("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}
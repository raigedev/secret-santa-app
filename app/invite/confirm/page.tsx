"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthPageFrame } from "@/app/components/AuthPageShell";
import { isInviteTokenHash } from "@/lib/auth/invite-token";

export default function ConfirmEmailInvitePage() {
  const [tokenHash, setTokenHash] = useState<string | null>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const hash = window.location.hash.slice(1);
      const candidate = new URLSearchParams(hash).get("token_hash");
      setTokenHash(isInviteTokenHash(candidate) ? candidate : null);

      if (hash) {
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <AuthPageFrame gridClassName="max-w-md">
      <section className="rounded-3xl bg-white p-6 text-center sm:p-8">
        <Image src="/secret-santa-logo.png" alt="My Secret Santa" width={56} height={56} className="mx-auto" />
        <h1 className="mt-4 text-2xl font-black text-[#2e3432]">
          {tokenHash === null ? "Invitation link unavailable" : "Open your invitation"}
        </h1>
        {tokenHash === null ? (
          <p role="status" className="mt-3 text-sm leading-6 text-[#64748b]">
            This link may have expired or already been used. Ask your organizer for a fresh invite,
            or log in with the invited email address.
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[#64748b]">
            Continue to sign in with the account this invitation was sent to.
          </p>
        )}
        {tokenHash && (
          <form action="/auth/callback" method="post" className="mt-6" onSubmit={() => setSubmitting(true)}>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <button type="submit" className="gift-button gift-button-primary w-full" disabled={submitting}>
              {submitting ? "Opening invitation..." : "Continue to invitation"}
            </button>
          </form>
        )}
        <Link href="/login?next=%2Fgroups" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-[#48664e] underline-offset-4 hover:underline">
          Log in
        </Link>
      </section>
    </AuthPageFrame>
  );
}

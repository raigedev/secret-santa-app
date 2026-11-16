"use client";

import { useEffect, useRef, useState } from "react";

// Cloudflare Turnstile guards sign-up, login, and password reset against bots. It stays
// off until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so forms behave exactly as before
// without it. Supabase verifies the token once CAPTCHA is enabled in its Auth settings.
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const BOT_CHECK_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
export const BOT_CHECK_ENABLED = BOT_CHECK_SITE_KEY.length > 0;
export const BOT_CHECK_PENDING_MESSAGE =
  "Please wait a moment while we confirm you are not a robot, then try again.";

type TurnstileRenderOptions = {
  appearance: "interaction-only";
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  sitekey: string;
};

type TurnstileApi = {
  remove: (widgetId: string) => void;
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        if (window.turnstile) {
          resolve(window.turnstile);
        } else {
          reject(new Error("Turnstile loaded without its API."));
        }
      };
      script.onerror = () => {
        turnstileScriptPromise = null;
        reject(new Error("Turnstile could not load."));
      };
      document.head.appendChild(script);
    });
  }

  return turnstileScriptPromise;
}

type BotCheckProps = {
  // Turnstile tokens work once, so forms bump resetKey after every submit attempt.
  resetKey: number;
  onTokenChange: (token: string | null) => void;
};

export function BotCheck({ onTokenChange, resetKey }: BotCheckProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    const container = containerRef.current;

    if (!BOT_CHECK_ENABLED || !container) {
      return;
    }

    let cancelled = false;

    loadTurnstile().then(
      (turnstile) => {
        if (cancelled) {
          return;
        }

        widgetIdRef.current = turnstile.render(container, {
          appearance: "interaction-only",
          callback: (token) => onTokenChangeRef.current(token),
          "error-callback": () => onTokenChangeRef.current(null),
          "expired-callback": () => onTokenChangeRef.current(null),
          sitekey: BOT_CHECK_SITE_KEY,
        });
      },
      () => {
        if (!cancelled) {
          onTokenChangeRef.current(null);
          setLoadFailed(true);
        }
      }
    );

    return () => {
      cancelled = true;

      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (resetKey === 0 || !widgetIdRef.current) {
      return;
    }

    onTokenChangeRef.current(null);
    window.turnstile?.reset(widgetIdRef.current);
  }, [resetKey]);

  if (!BOT_CHECK_ENABLED) {
    return null;
  }

  return (
    <div data-testid="bot-check">
      <div ref={containerRef} />
      {loadFailed && (
        <p role="alert" className="mt-2 text-sm font-semibold text-[#b91c1c]">
          We could not load the security check. Refresh the page and try again.
        </p>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getSantaAssistantTips,
  type SantaAssistantTip,
} from "@/lib/santaAssistantTips";

const SEEN_STORAGE_KEY = "secret-santa-assistant-seen-v1";
const MINIMIZED_STORAGE_KEY = "secret-santa-assistant-minimized-v1";

const HIDDEN_ROUTE_PREFIXES = [
  "/login",
  "/create-account",
  "/forgot-password",
  "/reset-password",
  "/invite",
  "/privacy",
  "/cool-app",
] as const;

function shouldShowAssistant(pathname: string): boolean {
  if (pathname === "/") {
    return false;
  }

  return !HIDDEN_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export type SantaAssistantState = {
  close: () => void;
  isMinimized: boolean;
  isOpen: boolean;
  minimize: () => void;
  nextTip: () => void;
  open: () => void;
  pathname: string;
  previousTip: () => void;
  shouldRender: boolean;
  tip: SantaAssistantTip;
  tipCount: number;
  tipIndex: number;
};

export function useSantaAssistant(): SantaAssistantState {
  const pathname = usePathname();
  const tips = useMemo(() => getSantaAssistantTips(pathname), [pathname]);
  const shouldRender = shouldShowAssistant(pathname);
  const [tipState, setTipState] = useState({ index: 0, pathname });
  const tipIndex = tipState.pathname === pathname ? Math.min(tipState.index, tips.length - 1) : 0;
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!shouldRender) {
        setIsOpen(false);
        return;
      }

      const minimized = window.localStorage.getItem(MINIMIZED_STORAGE_KEY) === "true";
      const seen = window.localStorage.getItem(SEEN_STORAGE_KEY) === "true";

      setIsMinimized(minimized);
      setIsOpen(!minimized && !seen);

      if (!seen) {
        window.localStorage.setItem(SEEN_STORAGE_KEY, "true");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [shouldRender, pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const open = useCallback(() => {
    window.localStorage.setItem(MINIMIZED_STORAGE_KEY, "false");
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const minimize = useCallback(() => {
    window.localStorage.setItem(MINIMIZED_STORAGE_KEY, "true");
    setIsMinimized(true);
    setIsOpen(false);
  }, []);

  const nextTip = useCallback(() => {
    setTipState((current) => ({
      index: ((current.pathname === pathname ? current.index : 0) + 1) % tips.length,
      pathname,
    }));
  }, [pathname, tips.length]);

  const previousTip = useCallback(() => {
    setTipState((current) => ({
      index: ((current.pathname === pathname ? current.index : 0) - 1 + tips.length) % tips.length,
      pathname,
    }));
  }, [pathname, tips.length]);

  return {
    close,
    isMinimized,
    isOpen,
    minimize,
    nextTip,
    open,
    pathname,
    previousTip,
    shouldRender,
    tip: tips[tipIndex] || tips[0],
    tipCount: tips.length,
    tipIndex,
  };
}

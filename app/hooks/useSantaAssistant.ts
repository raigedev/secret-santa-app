"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getSantaAssistantAnswer,
  getSantaAssistantTips,
  type SantaAssistantAnswer,
  type SantaAssistantTip,
} from "@/lib/santaAssistantTips";
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from "@/lib/client-snapshot";

const SEEN_STORAGE_KEY = "secret-santa-assistant-seen-v1";
const MINIMIZED_STORAGE_KEY = "secret-santa-assistant-minimized-v1";
const HIDDEN_STORAGE_KEY = "secret-santa-assistant-hidden-v1";
export const SANTA_ASSISTANT_VISIBILITY_EVENT = "secret-santa-assistant-visibility-changed";

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

type SantaAssistantState = {
  close: () => void;
  hide: () => void;
  isHidden: boolean;
  isMinimized: boolean;
  isOpen: boolean;
  lastAnswer: SantaAssistantAnswer | null;
  minimize: () => void;
  nextTip: () => void;
  open: () => void;
  pathname: string;
  previousTip: () => void;
  submitQuestion: (question: string) => void;
  shouldRender: boolean;
  tip: SantaAssistantTip;
  tipCount: number;
  tipIndex: number;
};

export function readSantaAssistantHiddenPreference(): boolean {
  return readLocalStorageItem(HIDDEN_STORAGE_KEY) === "true";
}

export function setSantaAssistantHiddenPreference(hidden: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  if (hidden) {
    writeLocalStorageItem(HIDDEN_STORAGE_KEY, "true");
  } else {
    removeLocalStorageItem(HIDDEN_STORAGE_KEY);
    writeLocalStorageItem(MINIMIZED_STORAGE_KEY, "false");
  }

  window.dispatchEvent(
    new CustomEvent(SANTA_ASSISTANT_VISIBILITY_EVENT, {
      detail: { hidden },
    })
  );
}

export function useSantaAssistant(): SantaAssistantState {
  const pathname = usePathname();
  const tips = useMemo(() => getSantaAssistantTips(pathname), [pathname]);
  const [isHidden, setIsHidden] = useState(() => readSantaAssistantHiddenPreference());
  const shouldRender = shouldShowAssistant(pathname) && !isHidden;
  const [tipState, setTipState] = useState({ index: 0, pathname });
  const tipIndex = tipState.pathname === pathname ? Math.min(tipState.index, tips.length - 1) : 0;
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<SantaAssistantAnswer | null>(null);

  useEffect(() => {
    const syncHiddenPreference = () => {
      const hidden = readSantaAssistantHiddenPreference();
      setIsHidden(hidden);

      if (hidden) {
        setIsOpen(false);
      }
    };

    syncHiddenPreference();
    window.addEventListener("storage", syncHiddenPreference);
    window.addEventListener(SANTA_ASSISTANT_VISIBILITY_EVENT, syncHiddenPreference);

    return () => {
      window.removeEventListener("storage", syncHiddenPreference);
      window.removeEventListener(SANTA_ASSISTANT_VISIBILITY_EVENT, syncHiddenPreference);
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!shouldRender) {
        setIsOpen(false);
        return;
      }

      const minimized = readLocalStorageItem(MINIMIZED_STORAGE_KEY) === "true";
      const seen = readLocalStorageItem(SEEN_STORAGE_KEY) === "true";

      setIsMinimized(minimized);
      setIsOpen(!minimized && !seen);

      if (!seen) {
        writeLocalStorageItem(SEEN_STORAGE_KEY, "true");
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
    writeLocalStorageItem(MINIMIZED_STORAGE_KEY, "false");
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setLastAnswer(null);
  }, []);

  const minimize = useCallback(() => {
    writeLocalStorageItem(MINIMIZED_STORAGE_KEY, "true");
    setIsMinimized(true);
    setIsOpen(false);
  }, []);

  const hide = useCallback(() => {
    setSantaAssistantHiddenPreference(true);
    setIsHidden(true);
    setIsMinimized(true);
    setIsOpen(false);
    setLastAnswer(null);
  }, []);

  const nextTip = useCallback(() => {
    setLastAnswer(null);
    setTipState((current) => ({
      index: ((current.pathname === pathname ? current.index : 0) + 1) % tips.length,
      pathname,
    }));
  }, [pathname, tips.length]);

  const previousTip = useCallback(() => {
    setLastAnswer(null);
    setTipState((current) => ({
      index: ((current.pathname === pathname ? current.index : 0) - 1 + tips.length) % tips.length,
      pathname,
    }));
  }, [pathname, tips.length]);

  const submitQuestion = useCallback(
    (question: string) => {
      setLastAnswer(getSantaAssistantAnswer(question, pathname));
      setIsOpen(true);
    },
    [pathname]
  );

  return {
    close,
    hide,
    isHidden,
    isMinimized,
    isOpen,
    lastAnswer,
    minimize,
    nextTip,
    open,
    pathname,
    previousTip,
    submitQuestion,
    shouldRender,
    tip: tips[tipIndex] || tips[0],
    tipCount: tips.length,
    tipIndex,
  };
}

import { useEffect, useRef, useState } from "react";
import type { ProfileMenuPosition } from "./dashboard-types";

export function useDashboardProfileMenu() {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState<ProfileMenuPosition>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !profileMenuRef.current?.contains(target) &&
        !profileMenuPanelRef.current?.contains(target)
      ) {
        setProfileMenuOpen(false);
        setProfileMenuPosition(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setProfileMenuPosition(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const updateProfileMenuPosition = () => {
      const trigger = profileMenuRef.current;
      if (!trigger || typeof window === "undefined") {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const width = window.innerWidth < 640
        ? Math.min(220, Math.max(188, window.innerWidth - 28))
        : Math.min(248, Math.max(224, window.innerWidth - 32));
      const left = Math.min(
        Math.max(16, rect.right - width),
        Math.max(16, window.innerWidth - width - 16)
      );

      setProfileMenuPosition({
        top: rect.bottom + 8,
        left,
        width,
      });
    };

    updateProfileMenuPosition();
    window.addEventListener("resize", updateProfileMenuPosition);
    window.addEventListener("scroll", updateProfileMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateProfileMenuPosition);
      window.removeEventListener("scroll", updateProfileMenuPosition, true);
    };
  }, [profileMenuOpen]);

  const closeProfileMenu = () => {
    setProfileMenuOpen(false);
    setProfileMenuPosition(null);
  };

  const toggleProfileMenu = () => {
    if (profileMenuOpen) {
      setProfileMenuPosition(null);
    }
    setProfileMenuOpen((current) => !current);
  };

  return {
    closeProfileMenu,
    profileMenuOpen,
    profileMenuPanelRef,
    profileMenuPosition,
    profileMenuRef,
    toggleProfileMenu,
  };
}

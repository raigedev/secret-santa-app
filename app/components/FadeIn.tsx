"use client";

// ═══════════════════════════════════════
// FADE-IN PAGE TRANSITION
// ═══════════════════════════════════════
// Wraps page content with staggered fade-in.
// Each child with data-fade gets delayed animation.
// ═══════════════════════════════════════

import { useEffect, useRef } from "react";

export default function FadeIn({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Animate all direct children with stagger
    const children = el.querySelectorAll("[data-fade]");
    children.forEach((child, i) => {
      const htmlChild = child as HTMLElement;
      if (prefersReducedMotion) {
        htmlChild.style.opacity = "1";
        htmlChild.style.transform = "none";
        htmlChild.style.transition = "none";
        return;
      }

      htmlChild.style.willChange = "opacity, transform";
      htmlChild.style.opacity = "0";
      htmlChild.style.transform = "translateY(8px)";
      htmlChild.style.transition = `opacity .22s ease-out ${i * 0.035}s, transform .22s ease-out ${i * 0.035}s`;

      // Trigger on next frame
      requestAnimationFrame(() => {
        htmlChild.style.opacity = "1";
        htmlChild.style.transform = "translateY(0)";
      });
    });
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

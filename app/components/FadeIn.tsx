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

    // Animate all direct children with stagger
    const children = el.querySelectorAll("[data-fade]");
    children.forEach((child, i) => {
      const htmlChild = child as HTMLElement;
      htmlChild.style.opacity = "0";
      htmlChild.style.transform = "translateY(12px)";
      htmlChild.style.transition = `opacity .35s ease ${i * 0.05}s, transform .35s ease ${i * 0.05}s`;

      // Trigger on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          htmlChild.style.opacity = "1";
          htmlChild.style.transform = "translateY(0)";
        });
      });
    });
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
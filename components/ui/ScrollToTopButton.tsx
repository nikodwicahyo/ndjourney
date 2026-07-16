"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  threshold?: number;
  /** "public" stacks above the music toggle (bottom-right); "dashboard" sits just above the bottom nav. */
  variant?: "public" | "dashboard";
};

export default function ScrollToTopButton({
  className,
  threshold = 400,
  variant = "dashboard",
}: Props) {
  const [visible, setVisible] = useState(false);
  const [selectMode, setSelectMode] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setSelectMode(el.hasAttribute("data-select-mode"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ["data-select-mode"] });
    return () => observer.disconnect();
  }, []);

  return (
    <button
      type="button"
      aria-label="Kembali ke atas"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 hover:scale-105 hover:opacity-90",
        variant === "public"
          ? "bottom-36 lg:bottom-20"
          : "bottom-24 lg:bottom-6",
        selectMode && "bottom-32 lg:bottom-24",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        className,
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

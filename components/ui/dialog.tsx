"use client";

import { forwardRef, useContext, createContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type DialogContextType = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextType>({
  open: false,
  onOpenChange: () => {},
});

function Dialog({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogContext.Provider
      value={{ open, onOpenChange: onOpenChange ?? (() => {}) }}
    >
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const { onOpenChange } = useContext(DialogContext);
  return (
    <button onClick={() => { onOpenChange(true); onClick?.(); }}>
      {children}
    </button>
  );
}

const DialogContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open, onOpenChange } = useContext(DialogContext);
  const [mounted, setMounted] = useState(open);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<Element | null>(null);

  // Mount on open during render (React-endorsed adjustment) so the effect
  // below only handles exit timing, overflow lock, and focus — never a
  // synchronous setState that would cascade renders.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement;
      document.body.style.overflow = "hidden";
      // Move focus inside on open (next frame so the node is mounted).
      const t = setTimeout(() => {
        const root = contentRef.current;
        const first = root?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        (first ?? root)?.focus();
      }, 0);
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    } else {
      const timer = setTimeout(() => setMounted(false), 200);
      document.body.style.overflow = "";
      // Return focus to the trigger on close.
      (restoreRef.current as HTMLElement | null)?.focus?.();
      restoreRef.current = null;
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      // Minimal Tab trap while open.
      if (e.key === "Tab" && open) {
        const root = contentRef.current;
        if (!root) return;
        const items = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute("disabled"));
        if (items.length === 0) {
          e.preventDefault();
          root.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    if (open) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!mounted && !open) return null;

  const setRefs = (node: HTMLDivElement | null) => {
    contentRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={setRefs}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-lg outline-none",
          open ? "animate-in fade-in zoom-in-95" : "animate-out fade-out zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </>
  );
});
DialogContent.displayName = "DialogContent";

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col space-y-1.5 text-center sm:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("font-heading text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription };

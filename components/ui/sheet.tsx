"use client";

import { forwardRef, useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({ open, onOpenChange, children }: SheetProps) {
  return (
    <SheetContext open={open} onOpenChange={onOpenChange}>
      {children}
    </SheetContext>
  );
}

import { createContext, useContext } from "react";

type SheetContextType = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SheetContext_ = createContext<SheetContextType>({
  open: false,
  onOpenChange: () => {},
});

function SheetContext({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <SheetContext_.Provider
      value={{ open, onOpenChange: onOpenChange ?? (() => {}) }}
    >
      {children}
    </SheetContext_.Provider>
  );
}

function SheetTrigger({
  children,
  asChild,
  onClick,
}: {
  children: React.ReactNode;
  asChild?: boolean;
  onClick?: () => void;
}) {
  const { onOpenChange } = useContext(SheetContext_);

  if (asChild) {
    return <span onClick={() => { onOpenChange(true); onClick?.(); }}>{children}</span>;
  }

  return (
    <button
      onClick={() => { onOpenChange(true); onClick?.(); }}
      className="inline-flex items-center justify-center"
    >
      {children}
    </button>
  );
}

const SheetContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { side?: "left" | "right" | "top" | "bottom" }
>(({ className, children, side = "right", ...props }, ref) => {
  const { open, onOpenChange } = useContext(SheetContext_);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => setMounted(false), 200);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!mounted && !open) return null;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={ref}
        className={cn(
          "fixed z-50 gap-4 bg-background p-6 shadow-lg transition-transform",
          side === "right" && "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l",
          side === "left" && "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r",
          side === "top" && "inset-x-0 top-0 border-b",
          side === "bottom" && "inset-x-0 bottom-0 border-t",
          open
            ? "translate-x-0 translate-y-0"
            : side === "right"
              ? "translate-x-full"
              : side === "left"
                ? "-translate-x-full"
                : side === "top"
                  ? "-translate-y-full"
                  : "translate-y-full",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </>
  );
});
SheetContent.displayName = "SheetContent";

function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-2 text-center sm:text-left",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("font-heading text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle };

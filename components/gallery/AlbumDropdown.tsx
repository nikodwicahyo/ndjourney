"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Folder, Check, ChevronDown } from "lucide-react";
import type { AlbumWithCount } from "@/types";

type AlbumDropdownProps = {
  albums?: AlbumWithCount[];
  value: string;
  onChange: (albumId: string) => void;
  placeholder?: string;
  direction?: "up" | "down";
};

export default function AlbumDropdown({
  albums,
  value,
  onChange,
  placeholder = "Pindahkan ke album",
  direction = "down",
}: AlbumDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = albums?.find((a) => a.id === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none transition-colors sm:w-44 sm:flex-none",
          value
            ? "border-primary bg-primary/10 text-primary"
            : "border-input bg-background text-muted-foreground hover:bg-accent",
        )}
      >
        <Folder className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{selected ? selected.name : placeholder}</span>
        <ChevronDown
          className={cn(
            "ml-auto h-3 w-3 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-card shadow-lg",
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <div className="max-h-64 overflow-y-auto p-1.5">
            {albums?.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Belum ada album</p>
            )}
            {albums?.map((album) => (
              <button
                key={album.id}
                type="button"
                onClick={() => {
                  onChange(album.id);
                  setOpen(false);
                }}
                title={album.description || album.name}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors",
                  album.id === value
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-accent",
                )}
              >
                <span className="truncate">{album.name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="tabular-nums text-muted-foreground/60">
                    {album._count.photos}
                  </span>
                  {album.id === value && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

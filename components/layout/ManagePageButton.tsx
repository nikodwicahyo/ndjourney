"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Settings2 } from "lucide-react";

type ManagePageButtonProps = {
  href: string;
  label: string;
};

// ponytail: self-gated — server pages stay untouched (no auth() + prop
// drilling per page); renders nothing until authenticated is confirmed,
// so anonymous visitors (the common public case) see zero layout shift.
export default function ManagePageButton({ href, label }: ManagePageButtonProps) {
  const { status } = useSession();

  if (status !== "authenticated") return null;

  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:self-center"
    >
      <Settings2 className="h-4 w-4" />
      {label}
    </Link>
  );
}

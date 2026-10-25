"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

type BackLinkProps = ComponentProps<typeof Link>;

// Back to the previous entry (restores list scroll/tab) instead of pushing the
// parent route and landing at the top. Falls back to href on a direct visit.
export default function BackLink({ href, onClick, ...props }: BackLinkProps) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    if (window.history.length > 1) router.back();
    else router.push(href.toString());
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}

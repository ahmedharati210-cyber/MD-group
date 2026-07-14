"use client";

import { Loader2 } from "lucide-react";
import { useLinkStatus } from "next/link";

type Props = {
  className?: string;
};

/**
 * Inline spinner for Link descendants — shows after ~100ms if navigation is still pending.
 */
export function LinkPendingSpinner({ className = "" }: Props) {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 transition-opacity duration-150 ${
        pending ? "opacity-100 delay-0" : "opacity-0 delay-100"
      } ${className}`}
    >
      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />
    </span>
  );
}

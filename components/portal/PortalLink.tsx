"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

type PortalLinkProps = ComponentProps<typeof Link>;

/**
 * Portal navigation link that preserves scroll position by default.
 * Pass scroll={true} when jumping to a new section should start at the top.
 */
export function PortalLink({ scroll = false, ...props }: PortalLinkProps) {
  return <Link scroll={scroll} {...props} />;
}

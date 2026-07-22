"use client";

let lastPreservedScrollY = 0;

/**
 * Keep window scroll position across router.refresh / server-action revalidation.
 */
export function restoreScrollY(y: number = lastPreservedScrollY): void {
  if (typeof window === "undefined") return;
  const target = y;
  const restore = () => {
    window.scrollTo({ top: target, left: 0, behavior: "instant" as ScrollBehavior });
  };
  restore();
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
  window.setTimeout(restore, 50);
  window.setTimeout(restore, 150);
  window.setTimeout(restore, 300);
}

export function preserveScrollAround(run: () => void | Promise<void>): void {
  if (typeof window === "undefined") {
    void run();
    return;
  }
  lastPreservedScrollY = window.scrollY;
  void Promise.resolve(run()).finally(() => restoreScrollY(lastPreservedScrollY));
}

/** Wrap a useActionState dispatch / form action so scroll is captured before submit. */
export function withPreservedScroll(
  action: (formData: FormData) => void | Promise<void>,
): (formData: FormData) => void {
  return (formData) => {
    preserveScrollAround(() => action(formData));
  };
}

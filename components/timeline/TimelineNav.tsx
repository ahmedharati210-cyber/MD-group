"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string };

type Props = {
  categories: Category[];
};

/**
 * Sticky horizontal navigation for the project detail page.
 * Renders anchor links for each category so users can jump directly
 * to a specific section on long projects.
 */
export function TimelineNav({ categories }: Props) {
  const [activeId, setActiveId] = useState<string | null>(
    categories[0]?.id ?? null,
  );
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    observerRef.current = observer;

    for (const cat of categories) {
      const el = document.getElementById(`cat-${cat.id}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [categories]);

  if (categories.length === 0) return null;

  function scrollTo(catId: string) {
    const el = document.getElementById(`cat-${catId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <nav
      aria-label="التنقل بين الفئات"
      className="sticky top-0 z-10 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-5 print:hidden"
    >
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2.5">
        {categories.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollTo(cat.id)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}


import Image from "next/image";
import { cn } from "@/lib/utils";

/** Dolce Chocolate brand mark — light/dark variants match signup flow. */
export function DolceBrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative w-full max-w-[160px] aspect-[2/1] mx-auto",
        className,
      )}
    >
      <Image
        src="/logos/dolce-logo-light.png"
        alt="Dolce Chocolate"
        fill
        className="object-contain dark:hidden"
        priority={priority}
      />
      <Image
        src="/logos/dolce-logo.png"
        alt="Dolce Chocolate"
        fill
        className="object-contain hidden dark:block"
        priority={priority}
      />
    </div>
  );
}

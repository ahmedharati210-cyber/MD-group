import { requireUser } from "@/lib/auth";

export default async function TimelineLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div>{children}</div>;
}

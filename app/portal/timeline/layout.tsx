import { connection } from "next/server";
import { requireUser } from "@/lib/auth";

export default async function TimelineLayout({ children }: { children: React.ReactNode }) {
  await connection();
  await requireUser();
  return <div>{children}</div>;
}

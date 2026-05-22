import { NextResponse } from "next/server";
import { getVapidPublicKey, isWebPushConfigured } from "@/lib/push/config";

export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push not configured" }, { status: 503 });
  }
  return NextResponse.json({ publicKey: getVapidPublicKey() });
}

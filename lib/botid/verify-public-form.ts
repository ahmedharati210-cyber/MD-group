import "server-only";

import { checkBotId } from "botid/server";

const BOT_REJECTION_MESSAGE =
  "تعذر إرسال الطلب. يرجى المحاولة لاحقاً أو التواصل مع الإدارة.";

/**
 * Returns an Arabic user-facing error when Vercel BotID flags the request.
 * Skipped in development so local testing stays frictionless.
 */
export async function rejectIfBot(): Promise<string | null> {
  if (process.env.NODE_ENV === "development") {
    return null;
  }

  try {
    const { isBot } = await checkBotId();
    if (isBot) {
      return BOT_REJECTION_MESSAGE;
    }
  } catch (error) {
    // Fail open if BotID is not configured yet on the Vercel project.
    console.warn("[botid] verification skipped", error);
  }

  return null;
}

import "server-only";

/** Validates `env.mjs` (including WhatsApp keys on the server) when this module loads. */
import "../env.mjs";

const GRAPH_API_VERSION = "v21.0";

/**
 * Default Meta sample template — Utility, no variables, language en_US.
 * Use for connectivity tests until your Arabic template is Active.
 */
export const DEFAULT_WHATSAPP_TEMPLATE_NAME = "hello_world";

/** @deprecated Use DEFAULT_WHATSAPP_TEMPLATE_NAME */
export const DEFAULT_WHATSAPP_WARNING_TEMPLATE_NAME = DEFAULT_WHATSAPP_TEMPLATE_NAME;

/** Meta expects recipient as digits with country code, no + prefix. */
export function normalizeWhatsAppRecipient(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8) return null;

  // Already full international Libya (+218 stored as 218…)
  if (digits.startsWith("218") && digits.length >= 11 && digits.length <= 12) {
    return digits;
  }

  // Libya local mobile: 10 digits starting with 09… → 218 + drop leading 0
  // e.g. 0920003534 → 218920003534 (matches Meta "To" / allowlist format)
  if (digits.length === 10 && digits.startsWith("0") && digits[1] === "9") {
    return `218${digits.slice(1)}`;
  }

  // National mobile without leading 0 (9 digits starting with 9)
  if (digits.length === 9 && digits.startsWith("9")) {
    return `218${digits}`;
  }

  return digits;
}

function resolveTemplateConfig(overrideName?: string): {
  name: string;
  languageCode: string;
  includeBodyParameter: boolean;
} {
  const name = (
    overrideName ??
    process.env.WHATSAPP_TEMPLATE_NAME ??
    DEFAULT_WHATSAPP_TEMPLATE_NAME
  ).trim();

  const lower = name.toLowerCase();
  const isHelloWorld = lower === "hello_world";

  const languageCode =
    process.env.WHATSAPP_TEMPLATE_LANGUAGE ??
    (isHelloWorld ? "en_US" : "ar");

  return {
    name,
    languageCode,
    includeBodyParameter: !isHelloWorld,
  };
}

/**
 * Sends a template message via Meta WhatsApp Cloud API.
 * - `hello_world`: no body variables (message ignored for API body).
 * - Any other name: one body text parameter (`message`), Arabic by default unless WHATSAPP_TEMPLATE_LANGUAGE is set.
 * Swallows errors (logs only) so callers can fire-and-forget without blocking DB flows.
 */
export async function sendWhatsAppTemplate(
  toPhone: string,
  message: string,
  templateName?: string,
): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.warn("[whatsapp] Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    return;
  }

  const to = normalizeWhatsAppRecipient(toPhone);
  if (!to) {
    console.warn("[whatsapp] Invalid or empty phone:", toPhone);
    return;
  }

  const { name, languageCode, includeBodyParameter } =
    resolveTemplateConfig(templateName);

  const templatePayload: Record<string, unknown> = {
    name,
    language: { code: languageCode },
  };

  if (includeBodyParameter) {
    const bodyText = message.slice(0, 1024);
    templatePayload.components = [
      {
        type: "body",
        parameters: [{ type: "text", text: bodyText }],
      },
    ];
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: templatePayload,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401) {
        console.error(
          "[whatsapp] API error 401 — WHATSAPP_TOKEN is invalid or expired. " +
            "Generate a new token in Meta Business Suite and update WHATSAPP_TOKEN " +
            "in Vercel project settings (md-group → Settings → Environment Variables).",
          errText,
        );
      } else {
        console.error("[whatsapp] API error", res.status, errText);
      }
    }
  } catch (e) {
    console.error("[whatsapp] Request failed", e);
  }
}

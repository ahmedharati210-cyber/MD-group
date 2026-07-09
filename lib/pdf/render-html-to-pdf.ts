import "server-only";

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeFilename(name: string): string {
  const safe = name
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return safe || "document";
}

export function contentDispositionHeader(
  filenameBase: string,
  ext: string,
): string {
  const ascii = sanitizeFilename(filenameBase);
  const encoded = encodeURIComponent(`${filenameBase}.${ext}`);
  return `attachment; filename="${ascii}.${ext}"; filename*=UTF-8''${encoded}`;
}

async function getBrowserExecutablePath(): Promise<string> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.VERCEL) {
    return chromium.executablePath();
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  return "/usr/bin/google-chrome";
}

export async function renderPdfFromHtml(html: string): Promise<Uint8Array> {
  const executablePath = await getBrowserExecutablePath();
  const browser = await puppeteer.launch({
    args: process.env.VERCEL
      ? chromium.args
      : ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 794, height: 1123 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluateHandle("document.fonts.ready");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1.5cm", right: "1.5cm", bottom: "1.5cm", left: "1.5cm" },
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}

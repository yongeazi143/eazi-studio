import fs from "fs";
import path from "path";

export function getGitHubToken(): string {
  // 1. Try to read directly from .env.local file to bypass OS-level overrides
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^GITHUB_TOKEN\s*=\s*(.+)$/m);
      if (match && match[1]) {
        const token = match[1].trim().replace(/^['"]|['"]$/g, "");
        if (token && !token.startsWith("github_pat_antigravity")) {
          return token;
        }
      }
    }
  } catch (e) {
    console.error("Failed to read .env.local for GITHUB_TOKEN:", e);
  }

  // 2. Fallback to process.env.GITHUB_TOKEN
  return process.env.GITHUB_TOKEN || "";
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  delayMs = 1500
): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        attempt++;
        if (attempt >= maxRetries) {
          return res;
        }
        const backoff = delayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`429 Rate limited. Retrying attempt ${attempt}/${maxRetries} after ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      return res;
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }
      const backoff = delayMs * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(`Fetch error. Retrying attempt ${attempt}/${maxRetries} after ${backoff}ms...`, error);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw new Error("Max retries reached");
}

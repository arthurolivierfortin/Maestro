/**
 * Poll a health endpoint with exponential backoff until it responds 200,
 * or the timeout is exceeded.
 */
export async function waitForHealth(
  url: string,
  timeoutMs: number,
  intervalMs = 500,
): Promise<boolean> {
  const start = Date.now();
  let delay = intervalMs;

  while (Date.now() - start < timeoutMs) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch {
      // Service not ready yet
    }

    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 3000); // exponential backoff, max 3s
  }

  return false;
}

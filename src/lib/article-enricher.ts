/**
 * Fetches a URL and extracts og:title / og:description via regex.
 * Never throws — returns nulls on any failure.
 */
export async function enrichArticleUrl(
  url: string
): Promise<{ title: string | null; description: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let html: string;
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Xpedia/1.0)' },
      });
      html = await res.text();
    } finally {
      clearTimeout(timeout);
    }

    const title =
      extractMeta(html, /property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ??
      extractMeta(html, /content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ??
      extractMeta(html, /<title[^>]*>([^<]+)<\/title>/i);

    const description =
      extractMeta(html, /property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ??
      extractMeta(html, /content=["']([^"']+)["'][^>]*property=["']og:description["']/i) ??
      extractMeta(html, /name=["']description["'][^>]*content=["']([^"']+)["']/i) ??
      extractMeta(html, /content=["']([^"']+)["'][^>]*name=["']description["']/i);

    return { title: title?.trim() ?? null, description: description?.trim() ?? null };
  } catch {
    return { title: null, description: null };
  }
}

function extractMeta(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ?? null;
}

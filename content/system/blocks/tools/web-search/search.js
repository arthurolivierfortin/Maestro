// Web Search tool block
//
// Inputs (via environment variables set by ToolBlockExecutor):
//   MAESTRO_INPUT_QUERY       — Search query (required)
//   MAESTRO_INPUT_MAXRESULTS  — Maximum number of results (optional, default: 5)
//
// Strategy:
//   1. Try SearXNG API (localhost:8888) — fast, reliable, no rate limiting
//   2. Fall back to DuckDuckGo HTML via HTTPS — no external dependency, HTML parsing
//
// Output: JSON with success, results [{title, url, snippet}], query, totalResults, source

const https = require('https');
const http = require('http');
const { URL } = require('url');

const query = process.env.MAESTRO_INPUT_QUERY || '';
const maxResults = parseInt(process.env.MAESTRO_INPUT_MAXRESULTS || '5', 10);

if (!query) {
  console.log(JSON.stringify({ success: false, error: 'Missing required input: query', results: [], query: '', totalResults: 0 }));
  process.exit(0);
}

function httpGet(urlStr, timeout = 10000, userAgent = 'Maestro/4.0') {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    const req = mod.get(urlStr, { timeout, headers: { 'User-Agent': userAgent } }, (res) => {
      // Follow redirects (301, 302, 303, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, urlStr).href;
        httpGet(redirectUrl, timeout, userAgent).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

// Extract the real URL from DuckDuckGo redirect URLs
// e.g., "//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com&rut=..." -> "https://example.com"
function extractRealUrl(ddgUrl) {
  try {
    // Normalize protocol-relative URLs
    let normalized = ddgUrl;
    if (normalized.startsWith('//')) normalized = 'https:' + normalized;

    const parsed = new URL(normalized);
    const uddg = parsed.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    return ddgUrl;
  } catch {
    return ddgUrl;
  }
}

async function trySearXNG() {
  const url = `http://localhost:8888/search?q=${encodeURIComponent(query)}&format=json&engines=google,duckduckgo&results=${maxResults}`;
  const res = await httpGet(url, 5000);
  if (res.status !== 200) throw new Error(`SearXNG returned ${res.status}`);
  const data = JSON.parse(res.data);
  return (data.results || []).slice(0, maxResults).map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || ''
  }));
}

async function tryDuckDuckGoHTML() {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  // Use a browser-like User-Agent to avoid bot detection
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const res = await httpGet(url, 10000, ua);
  if (res.status < 200 || res.status >= 300) throw new Error(`DuckDuckGo HTML returned ${res.status}`);

  const results = [];

  // DuckDuckGo HTML uses <a class="result__a"> for links and <a class="result__snippet"> for snippets
  const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*?)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = linkRegex.exec(res.data)) !== null && results.length < maxResults) {
    const rawUrl = match[1].replace(/&amp;/g, '&');
    const realUrl = extractRealUrl(rawUrl);
    const title = match[2].replace(/<[^>]*>/g, '').trim();
    if (title && realUrl) {
      results.push({ title, url: realUrl, snippet: '' });
    }
  }

  // Attach snippets
  let i = 0;
  while ((match = snippetRegex.exec(res.data)) !== null && i < results.length) {
    results[i].snippet = match[1].replace(/<[^>]*>/g, '').trim();
    i++;
  }

  if (results.length === 0) throw new Error('No results parsed from DuckDuckGo HTML');
  return results;
}

(async () => {
  let results = [];
  let source = 'none';

  // Strategy 1: SearXNG (local instance)
  try {
    results = await trySearXNG();
    source = 'searxng';
  } catch (e) {
    // Strategy 2: DuckDuckGo HTML
    try {
      results = await tryDuckDuckGoHTML();
      source = 'duckduckgo-html';
    } catch (e2) {
      console.log(JSON.stringify({
        success: false,
        error: `All search strategies failed. SearXNG: ${e.message}. DuckDuckGo: ${e2.message}`,
        results: [],
        query,
        totalResults: 0
      }));
      process.exit(0);
    }
  }

  console.log(JSON.stringify({
    success: true,
    results,
    query,
    totalResults: results.length,
    source
  }));
})();

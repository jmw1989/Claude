// Fetching pages from sites that block GitHub's servers.
import { readFile } from 'node:fs/promises';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

// Quiz sites often block requests from cloud servers like GitHub's, so if a
// direct request fails we go through other services that fetch the page for us.
export const ROUTES = [
  ['direct', (url) => url],
  ['allorigins', (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`],
  ['codetabs', (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`],
  ['jina', (url) => `https://r.jina.ai/${url}`, { 'X-Return-Format': 'html' }],
  ['wayback', (url) => `https://web.archive.org/web/2id_/${url}`],
];

function looksBlocked(html) {
  return html.length < 2000 || /Just a moment\.\.\.|cf-chl|_cf_chl_opt|Attention Required|Access denied/i.test(html.slice(0, 5000));
}

export async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers: { ...HEADERS, ...headers }, redirect: 'follow', signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Returns the page's HTML, trying each route in turn. `finalUrl` is always the requested URL.
export async function get(url, { routes = ROUTES } = {}) {
  const errors = [];
  for (const [name, wrap, headers] of routes) {
    try {
      const html = await fetchText(wrap(url), headers);
      if (looksBlocked(html)) throw new Error('blocked or empty page');
      console.log(`  ${name}: OK (${html.length} bytes) for ${url}`);
      return { html, finalUrl: url, via: name };
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      console.log(`  ${name}: failed (${err.message}) for ${url}`);
    }
  }
  throw new Error(`${url} could not be read (${errors.join('; ')})`);
}

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

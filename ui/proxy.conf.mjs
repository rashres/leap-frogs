/**
 * Dev-server proxy: the browser only ever calls same-origin /api/..., and the
 * Angular dev server forwards it.
 *
 *   /api/news   NewsAPI.org, with the key attached here so it never reaches the browser.
 *   /api        The Spring Boot API, including /api/yahoo (Yahoo Finance search, charts and
 *               headline RSS, fetched server-side so a deployed build works the same way).
 *
 * Point the API at a different host with LEAP_API_URL, e.g.
 *   LEAP_API_URL=http://10.0.0.5:8081 npm start
 *
 * The news key comes from LEAP_NEWSAPI_KEY in the environment or in ui/.env.local
 * (gitignored). Without it, headlines fall back to Yahoo.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Reads one KEY=value line from .env.local; a real environment variable wins. */
function envLocal(name) {
  if (process.env[name]) return process.env[name];
  try {
    for (const line of readFileSync(join(here, '.env.local'), 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match && match[1] === name) return match[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env.local */
  }
  return undefined;
}

// Prefer 127.0.0.1 over localhost so Node does not try ::1 first (Spring often binds IPv4 only).
const target = process.env.LEAP_API_URL || 'http://127.0.0.1:8081';
const newsApiKey = envLocal('LEAP_NEWSAPI_KEY');

if (!newsApiKey) {
  console.warn('[proxy] LEAP_NEWSAPI_KEY is not set; headlines will use the Yahoo fallback.');
}

// Order matters: the more specific /api/... prefixes must come before /api.
export default {
  '/api/news': {
    target: 'https://newsapi.org',
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/api/news': '' },
    headers: {
      ...(newsApiKey ? { 'X-Api-Key': newsApiKey } : {}),
      'User-Agent': 'leap-frogs-ui/dev',
    },
  },
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    // Spring redirects (/api -> /api/, Swagger UI) would otherwise point the browser straight at the API host.
    autoRewrite: true,
  },
};

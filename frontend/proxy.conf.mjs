/**
 * Dev-server proxy.
 *
 * Two upstreams. /api/news goes straight to NewsAPI, which sends no
 * Access-Control-Allow-Origin, so the browser cannot call it directly.
 * /api/yahoo goes to a local Python service (backend/main.py) that wraps
 * yfinance — routed through the same proxy so the frontend's fetch calls
 * don't care that the upstream changed.
 *
 * A deployed build has no dev server and therefore no proxy. The Spring backend
 * must expose the equivalent endpoints. See docs/open-questions.md OQ-10 and
 * OQ-15. Nothing here is a production configuration.
 *
 * WHY THIS FILE IS JAVASCRIPT AND NOT JSON. The news upstream needs an API key,
 * and a key committed to the repository is a leaked key. The key is read from
 * the environment here, on the Node side of the proxy, and attached as a
 * request header. It is never sent to the browser, never reaches the bundle,
 * and never appears in a commit. The browser only ever calls /api/news.
 *
 * [4.1][chore]
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Reads KEY=value lines from .env.local, which is gitignored.
 *
 * A real environment variable wins, so CI can inject one without a file.
 * Deliberately minimal: no dependency, no quoting rules beyond stripping one
 * matched pair, no export of anything it does not need.
 */
function envLocal(name) {
  if (process.env[name]) return process.env[name];
  try {
    for (const line of readFileSync(join(here, '.env.local'), 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match && match[1] === name) return match[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env.local — fall through to undefined */
  }
  return undefined;
}

const newsApiKey = envLocal('LEAP_NEWSAPI_KEY');

if (!newsApiKey) {
  console.warn(
    '[proxy] LEAP_NEWSAPI_KEY is not set. Headlines will report themselves unavailable\n' +
      '        rather than showing invented ones. Put the key in frontend/.env.local as\n' +
      '        LEAP_NEWSAPI_KEY=... (gitignored) or export it before `npm start`.',
  );
}

export default {
  // Local yfinance-backed service (backend/main.py, started by `npm start`).
  '/api/yahoo': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    pathRewrite: { '^/api/yahoo': '' },
  },

  // NewsAPI.org: headlines. Key attached here, server-side, never in the client.
  '/api/news': {
    target: 'https://newsapi.org',
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/api/news': '' },
    headers: {
      ...(newsApiKey ? { 'X-Api-Key': newsApiKey } : {}),
      // NewsAPI rejects requests without a User-Agent from some hosts.
      'User-Agent': 'leap-trading-platform/dev',
    },
  },
};

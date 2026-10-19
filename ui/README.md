# LEAP UI (`ui/`)

An Angular 21 trading front end for the LEAP Spring Boot API, with the look and
layout of the team's `fe/21-page-mascots` branch. Every account, holding, order
and price comes from the database through `/api`. There is no fixture data.

## Run it

## Demo users (RBAC)

Apply schema + seed once (against the operational DB):

```bash
psql -h localhost -p 8100 -U postgres -d leapfrogsdb -f database/rbac-schema.sql
psql -h localhost -p 8100 -U postgres -d leapfrogsdb -f database/rbac-seed.sql
```

Use the shared demo password from `LEAP_DEMO_PASSWORD` in your local `.env`
(repo-root `.env.example`). Do not commit that value.

| Username | Role               | Sign-in URL        | Lands on    |
|----------|--------------------|--------------------|-------------|
| `admin`  | SUPER_ADMIN        | `/admin/login`     | Portfolio   |
| `joanna` | TRADER             | `/login`           | Portfolio   |
| `priya`  | BUSINESS_ANALYST   | `/login`           | Analytics   |
| `david`  | TRADING_OPERATIONS | `/login`           | Operations  |

Start the API first (port 8081; see the repo-root README for the database), then:

```bash
cd ui
npm install
npm start            # http://localhost:4200
```

The dev server proxies `/api/*` to `http://localhost:8081`. To point at an API
somewhere else (for example the EC2 VM):

```bash
LEAP_API_URL=http://<host>:8081 npm start
```

Production build: `npm run build` (output in `ui/dist/leap-ui/browser`). The UI
calls only relative `/api/...` URLs, so serve it from a host that forwards
`/api/*` to the Spring API on the same origin (nginx, a load balancer rule, or
similar). Nothing else is needed: Yahoo data also comes through the API.

### Prices and charts

Prices come from `etl/price_fetcher.py` (yfinance), which writes
`instrument.last_price` in USD and records history in `instrument_price`. The
UI re-reads `GET /api/instruments`
every 10 seconds and draws charts from `GET /api/instruments/{id}/prices`.
Until the fetcher has run, prices show "—" and the header pill says **No prices**.

The Portfolio page's "Value over time" chart comes from
`GET /api/accounts/{id}/value-history?range=1D…1Y`. Nothing extra is stored: the
API starts from today's cash and holdings, undoes the filled orders in the range,
and values each holding at the price recorded at each point.

### News (optional)

Headlines come from NewsAPI.org when a key is set, and from Yahoo Finance search
otherwise. Put the key in `ui/.env.local` (gitignored) and restart `npm start`:

```bash
LEAP_NEWSAPI_KEY=your-key
```

The dev proxy attaches the key server-side, so it never reaches the browser.
NewsAPI is only available under `npm start`; other builds use Yahoo.

### Yahoo Finance (search, news fallback, volume)

Instrument search on Markets, the news fallback and the daily volume column call
`/api/yahoo/...`, which the Spring API answers (`YahooController`). It fetches
Yahoo server-side with a 5 s timeout, caches answers for 2 minutes, and serves
the last good answer (up to an hour old) when Yahoo fails. Settings are the
`yahoo.*` properties in `application.properties`.

These are Yahoo's public web endpoints, not a supported API: they need no key,
but Yahoo can rate-limit (429) or change them without notice. Market cap is not
shown because Yahoo's quote endpoints require a signed-in session.

## Pages

| Page | Route | Data |
| --- | --- | --- |
| Portfolio | `/portfolio` | Active account: `GET /accounts/{id}`, `/holdings`, `/orders`; valued at `lastPrice`; value chart (`/value-history?range=1D…1Y`) |
| Markets | `/markets` | `GET /instruments`, grouped by market (US, UK, India, FX, Crypto), with a watchlist star |
| Instrument | `/instrument/:id` | `GET /instruments/{id}`, chart (`/prices?range=1D…1Y`), news, your orders, and the order ticket (`POST /accounts/{id}/orders`) |
| Orders | `/orders` | `GET /accounts/{id}/orders`, filter Filled / Rejected, expandable rows |
| News | `/news` | Headlines for the database equities, with a word-list sentiment read |

The avatar in the header picks the account you act as (kept in localStorage).
The pill next to it shows API status (Live / No prices / DB down / Offline);
click it to refresh. The session dots show which markets in the database are open.

The order ticket has Buy and Sell tabs, a review step and a client-side preview
of a rejection. The API still decides every outcome:

- **201**: the ticket shows a Filled block with the fill price.
- **422**: it shows a Rejected block with the API's reason. The order is still saved as FAILED.
- **400 / 404 / API down**: it shows the error status and message.

Average cost and unrealised P/L are calculated in the browser from the
account's filled orders, because the API does not return them.

## Structure

```
src/app/
  core/api/      typed services per resource, ApiError + interceptor, createLoader()
  core/state/    active account, API health, market (instruments + prices), portfolio, watchlist
  core/markets/  trading sessions per exchange
  core/news/     NewsAPI / Yahoo providers, attribution and sentiment
  shared/        logo, mascot, live price, news feed, sentiment board, formatters
  features/      portfolio, markets, instrument (page + order ticket), orders, news
```

## Credits

Styles, page layouts, the order ticket flow, the news/sentiment code, instrument
logos, mascot images and the price chart are adapted from the team's
`fe/21-page-mascots` branch. They were copied file by file, not merged.
Multi-currency balances and order cancel from that branch were left out because
the API has no data for them.

## Known issues / out of scope (backend, not changed here)

- **Rejection reason only on POST.** `message` is returned only by the POST
  response. Rejected orders in `GET /orders` have `message: null`, because the
  reason is not stored.
- **Backfilled history uses today's exchange rate.** UK and India history
  loaded on the first fetch is converted to USD at the current rate, not the
  rate on each day.
- **Account types.** The three user types are not modelled yet; the account
  view will change once the database supports them.
- **`GET /api` redirects.** It answers 302 to `/api/`. The UI calls `/api/`
  directly, and the dev proxy rewrites redirect locations (`autoRewrite`).

# Traceability

Maps every story to its implementing files and covering tests, as required by
`CLAUDE.md` ("Traceability is a first-class requirement").

**Scope of this revision.** Only the Angular frontend exists. There is no
backend, no database, no Docker and no CI. Status values below are therefore
deliberately narrow — `Frontend only` means the behaviour is demonstrable in the
browser against fixture data and **is not persisted, audited or transactional**.
See `docs/open-questions.md` OQ-09 for exactly what that does not prove.

**BR column.** Only BR-08, BR-09, BR-14 and BR-16 have their content stated
anywhere in the available material (all quoted in `CLAUDE.md`). BR-05 appears
solely as an example commit tag with no content. Every other BR is `TBD` and
tracked as OQ-06 — `CLAUDE.md` forbids inventing requirements, so none have been
guessed.

Paths are relative to `frontend/src/app/` unless stated otherwise.

---

## PS-01 — Identity and Access

| US | BR | Status | Implementing files | Covering tests |
|----|----|--------|--------------------|----------------|
| US-01 Register with valid details | TBD | **Not started** | — | — |
| US-02 Secure sign-in | TBD | **Not started** | — | — |
| US-03 Client sees only their own data | TBD | **Not started** | — | — |
| US-04 Session timeout and revocation | TBD | **Not started** | — | — |

PS-01 is a backend authorisation concern. `CLAUDE.md` requires US-03 to be
enforced at the data access layer, which cannot be done in a browser client.
A single fixture account (`DEMO_ACCOUNT_ID`) stands in meanwhile.

---

## PS-02 — Order Placement and Execution

| US | BR | Status | Implementing files | Covering tests |
|----|----|--------|--------------------|----------------|
| US-05 Place a buy order | TBD | Frontend only | `features/instrument/order-ticket.ts`, `core/data/order.service.ts` | `core/data/pre-trade-validator.spec.ts` |
| US-06 Place a sell order | TBD | Frontend only | `features/instrument/order-ticket.ts`, `core/data/order.service.ts` | `core/data/pre-trade-validator.spec.ts` |
| US-07 Pre-trade validation | TBD | Frontend only | `core/data/pre-trade-validator.ts`, `core/domain/order.ts` | `core/data/pre-trade-validator.spec.ts` (12 cases, all reason codes) |
| US-08 Persist accepted orders | TBD | **Not started** | — | — |
| US-09 Real-time status updates | TBD | Frontend only | `features/portfolio/working-orders.ts`, `core/data/order.service.ts` | — |
| US-10 Execute against latest quote | BR-08 | Frontend only | `core/data/order.service.ts` (`fill()`), `core/data/market-data.service.ts` (`quoteForExecution()`) | — |
| US-11 Atomic updates | **BR-09** | **Not started** | `core/data/portfolio.service.ts` (`applyFill()`) is a single signal write, **not** a transaction | — |

**US-11 is explicitly not satisfied.** BR-09 is a database property and its
acceptance criterion is the mid-transaction failure test described in Prompt 3.
Nothing in a browser client can discharge it.

**US-10 / BR-08 note.** `quoteForExecution()` deliberately reads the price
imperatively at fill time and does not subscribe to the tick signal, so the
execution price is the price at the instant of execution.

---

## PS-03 — Holdings, Cash and History

| US | BR | Status | Implementing files | Covering tests |
|----|----|--------|--------------------|----------------|
| US-12 View holdings | TBD | Frontend only | `core/data/portfolio.service.ts`, `features/portfolio/holdings-table.ts`, `features/portfolio/performance-panel.ts` | — |
| US-13 View cash balance | TBD | Frontend only | `core/data/portfolio.service.ts`, `features/portfolio/cash-panel.ts` | `core/money/money.spec.ts` (cross-currency refusal) |
| US-14 Order history, chronological | TBD | Frontend only | `features/orders/orders-page.ts`, `core/data/order.service.ts` | — |

**US-13 note.** The response is a set of balances keyed by currency, never a
single number — see OQ-01. `Money` refuses cross-currency arithmetic outright.

---

## PS-04 — Market Data and Pricing

| US | BR | Status | Implementing files | Covering tests |
|----|----|--------|--------------------|----------------|
| US-15 Market data across five classes | TBD | Frontend only | `core/data/market-data.service.ts`, `core/data/quote-provider.ts`, `core/data/fixture-quote-provider.ts`, `core/data/yahoo-quote-provider.ts`, `core/domain/instrument.ts` | `core/domain/instrument.spec.ts` (hours, precision, settlement per class); `core/data/yahoo-quote-provider.spec.ts` (symbol mapping, GBp→GBP, parsing) |
| US-16 Indicative pricing before submit | BR-14 | Frontend only | `features/instrument/order-ticket.ts`, `core/domain/order.ts` (`QuoteSnapshot`) | — |

**US-15 note.** Quotes now come through a `QuoteProvider` seam with two
implementations. The fixture provider is the default and backs every test, so
Prompt 2's determinism argument still holds; a Yahoo adapter is opt-in per
session. See `docs/open-questions.md` OQ-10, including the LSE pence trap and
Yahoo's rate limiting.

**BR-14 note.** The quote shown to the client and the quote the order filled
against are stored as two separate `QuoteSnapshot` facts on the order, each with
its own observation timestamp. The order ticket and the order history both
display them side by side, along with the slippage between them.

---

## PS-05 — Audit and Compliance

| US | BR | Status | Implementing files | Covering tests |
|----|----|--------|--------------------|----------------|
| US-17 Permanent order audit trail | TBD | **Not started** | — | — |
| US-18 Pricing audit trail | TBD | **Not started** | — | — |
| US-19 Cash and holdings audit trail | TBD | **Not started** | — | — |
| US-20 Full lifecycle reconstruction | TBD | **Not started** | — | — |

The order lifecycle timeline shown in the UI (`OrderTransition[]`) is derived
from in-memory state, **not** replayed from an append-only log. It previews the
shape US-20 will need; it does not implement it.

---

## PS-06 — Reporting and Insights

| US | BR | Status | Implementing files | Covering tests |
|----|----|--------|--------------------|----------------|
| US-21 Analytics by instrument | TBD | **Not started** | — | — |
| US-22 Analytics by period | TBD | **Not started** | — | — |
| US-23 Analytics by client segment | TBD | **Not started** | — | — |
| US-24 Separate reporting workload | **BR-16** | **Not started** | — | — |
| US-25 Insights dashboard | TBD | **Not started** | — | — |

---

## Section 4.1 — Additional proposed capability

| Capability | Status | Implementing files | Covering tests |
|---|---|---|---|
| News with transparent headline sentiment | **Frontend only** | `core/domain/news.ts`, `core/data/news.service.ts`, `core/data/sentiment.ts`, `shared/news-feed.ts`, `features/news/news-page.ts` | `core/data/sentiment.spec.ts` (12 cases, including cases the scorer gets wrong) |
| Live headlines behind a provider seam | **Frontend only** — dev-server proxy, no backend | `core/data/news-provider.ts`, `core/data/newsapi-news-provider.ts`, `core/data/yahoo-news-provider.ts`, `proxy.conf.mjs` | `core/data/newsapi-news-provider.spec.ts` (18 cases: withdrawn articles, missing timestamps, failure mapping) |
| Sentiment per main stock | **Frontend only** | `core/data/news-attribution.ts`, `core/data/sentiment.ts` (`buildBoard`), `shared/stock-sentiment-board.ts` | `core/data/news-attribution.spec.ts` (17 cases, incl. real misfiling headlines), `core/data/sentiment.spec.ts` (6 board cases) |

**This is not a user story and is not counted as delivered scope.** Section 4.1
asks the author to propose and justify one additional capability; the author
proposed this one. Sentiment is computed locally from a fixed word list because
the upstream feed provides none, every score shows the words it matched, results
are reported as counts rather than percentages, and a disclaimer naming the
method accompanies every feed. No fabricated scores and no placeholder
headlines. Full reasoning and limitations in `docs/open-questions.md` OQ-11.

**On the stock board.** Headlines are filed against the platform's equities by
explicit name rules, not by the feed's own ticker field, and every row shows the
words that put a headline there. A stock with no headlines reads "no headlines"
rather than "neutral", and rows are ordered by volume of coverage rather than by
score — an ordering by score is a ranking of instruments, which this deliberately
is not. The news API key lives in a gitignored `.env.local` read by the
dev-server proxy and never reaches the browser or a commit; a deployed build
needs the Spring backend to own that call. Reasoning and the plan's limits in
`docs/open-questions.md` OQ-15.

---

## PS-07 — Watchlists and Alerts

| US | BR | Status | Implementing files | Covering tests |
|----|----|--------|--------------------|----------------|
| US-26 Watchlists and price alerts | TBD | **Partial** — watchlist only, alerts not started | `core/data/watchlist.service.ts`, `features/portfolio/watchlist-rail.ts`, `features/markets/markets-page.ts` | — |

The additional differentiating capability required by spec section 4.1 has
**not** been chosen. It is owned by the project author and is deliberately not
proposed here.

---

## Supporting infrastructure (`[chore]`, no story)

| Component | Purpose | Files | Tests |
|-----------|---------|-------|-------|
| `Decimal` | Exact decimal arithmetic; the frontend counterpart of `BigDecimal`. Explicit scale and `RoundingMode` at every lossy site. | `core/money/decimal.ts` | `core/money/decimal.spec.ts` (21 cases) |
| `Money` | Decimal bound to a currency; refuses cross-currency arithmetic. | `core/money/money.ts`, `core/money/currency.ts` | `core/money/money.spec.ts` (6 cases) |
| Instrument class strategy | Per-class settlement currency, precision, fractional permission, trading hours. | `core/domain/instrument.ts` | `core/domain/instrument.spec.ts` (9 cases) |
| Charting | Dependency-free SVG line chart and sparkline. | `shared/price-chart.ts`, `shared/sparkline.ts` | — |
| Brand marks | Inline-SVG instrument tiles from simple-icons (CC0), inlined rather than added as a dependency. No logo CDN, no image assets, nothing to 404. Microsoft and Amazon keep local marks — simple-icons has removed both. | `shared/brand.ts`, `shared/brand-marks.ts`, `shared/instrument-logo.ts` | — |
| Live price | Flashes the cell background on tick, never the digits — the adjacent day-change column already uses red/green for a different meaning. Compares Decimals, not formatted strings, so a sub-display move raises no phantom flash. | `shared/live-price.ts` | — |
| News provider seam | Two headline sources behind one interface, NewsAPI primary and keyless Yahoo as fallback. The key is attached by the dev-server proxy, never bundled. Failures degrade to a stated empty state; no fixture headlines exist anywhere. | `core/data/news-provider.ts`, `core/data/newsapi-news-provider.ts`, `core/data/yahoo-news-provider.ts`, `proxy.conf.mjs` | `core/data/newsapi-news-provider.spec.ts` (18 cases) |
| Quote provider seam | Two sources behind one interface; fixtures default and back all tests. The Yahoo adapter owns symbol mapping, the GBp→GBP conversion, float-free JSON parsing, and rate-limit backoff. | `core/data/quote-provider.ts`, `core/data/fixture-quote-provider.ts`, `core/data/yahoo-quote-provider.ts`, `core/data/data-source.service.ts` | `core/data/yahoo-quote-provider.spec.ts` (18 cases) |
| Demo persistence | localStorage round-trip so a demo survives reload. **Not US-08.** Amounts persist as integer unscaled units + scale because `Decimal` holds a `bigint` and `JSON.stringify` throws on it. | `core/data/persistence.ts` | `core/data/persistence.spec.ts` (6 cases, incl. a value beyond `Number.MAX_SAFE_INTEGER`) |
| Accessibility | Skip link, global `:focus-visible` ring, real links for table rows via a stretched overlay, `aria-live` order status, labelled icon-only controls, text-equivalent chart summaries. | `styles.scss`, `shared/price-chart.ts`, `features/portfolio/holdings-table.ts`, `features/portfolio/working-orders.ts` | Verified in-browser via CDP (17 checks) |

**Test totals:** 9 spec files, 121 cases, all passing (`npx ng test --no-watch`).

**In-browser verification** (headless Chrome via CDP, not unit tests): 17 checks
covering the review→confirm flow, exact cash and position movement, survival of
a full page reload, keyboard reachability and visible focus; plus 9 checks on
live-source degradation, confirming the app keeps its last good prices and
reports the real reason rather than blanking or inventing data.

---

## Summary

| Epic | Stories | Frontend only | Partial | Not started |
|------|---------|---------------|---------|-------------|
| PS-01 Identity and Access | 4 | 0 | 0 | 4 |
| PS-02 Order Placement and Execution | 7 | 5 | 0 | 2 |
| PS-03 Holdings, Cash and History | 3 | 3 | 0 | 0 |
| PS-04 Market Data and Pricing | 2 | 2 | 0 | 0 |
| PS-05 Audit and Compliance | 4 | 0 | 0 | 4 |
| PS-06 Reporting and Insights | 5 | 0 | 0 | 5 |
| PS-07 Watchlists and Alerts | 1 | 0 | 1 | 0 |
| **Total** | **26** | **10** | **1** | **15** |

No story is `Complete`. Completion requires persistence, audit and transactional
guarantees that only the backend can provide.

# Open questions and decision records

`CLAUDE.md` requires that anything which seems needed but has no BR or US behind
it is written here with its reasoning rather than silently built. This file is
that register. Entries are either **decisions taken in the spec's absence**
(which need confirming by whoever owns the trading rules) or **questions still
open**.

Last updated: 2026-08-27.

---

## OQ-01 — Multi-currency cash: per-currency balances, no automatic FX

**Status:** Decided, needs confirmation from the trading-rules owner.

The spec requires Equities UK (GBP), Equities US (USD), Equities India (INR), FX
and Crypto, but does not say whether a client holds one balance or several. Two
models were possible, and the choice is a rebuild rather than a patch if wrong.

**Decision.** `CashBalance` is keyed `(account, currency)`. An account holds GBP,
USD and INR independently. There is **no** conversion at trade time: a client
funded in GBP cannot buy a US equity until they hold USD, which they obtain by
placing an explicit FX order. Pre-trade validation checks the balance in the
instrument's *settlement currency* only.

**Reasoning.**
1. Auto-conversion would add a second priced leg to every cross-currency buy,
   which materially complicates the BR-09 atomicity test — the single most
   important test in the project per `CLAUDE.md`.
2. FX is already a required instrument class, so an explicit FX order reuses
   machinery that has to exist regardless.
3. `CLAUDE.md` states "Do not assume a single base currency", which rules out
   the third option outright.

**What confirmation is needed.** Whether the business expects a GBP-funded
client to be blocked from buying AAPL, or expects the platform to convert for
them. This is a client-visible behaviour, not an implementation detail.

---

## OQ-02 — Consolidated portfolio value is a display-only conversion

**Status:** Decided, needs confirmation.

OQ-01 means there is no single true "portfolio value" — an account holds three
currencies and none is convertible without a trade. But a client expects one
headline number, and every retail platform shows one.

**Decision.** The portfolio header shows a consolidated total in a
client-selected display currency (GBP, USD or INR), computed at indicative rates
derived from the FX instruments already in the market data set. It is labelled
as indicative directly beneath the figure. This conversion is **never** used to
price, validate or settle an order — `PreTradeValidator` has no access to it.

**Reasoning.** Showing three separate totals and no aggregate is accurate but
unusable. Showing one aggregate without saying how it was produced is
misleading. Labelling it is the only honest way to show both.

**What confirmation is needed.** Whether an indicative consolidated figure is
acceptable to compliance, and if so what rate source it must cite. A real
platform would need a stated rate source and timestamp; the fixture data has
neither.

---

## OQ-03 — US-09 "real-time status updates" means server-sent events

**Status:** Decided.

US-09's acceptance criterion is satisfied equally by polling, server-sent events
or websockets, which are very different amounts of work and very different
operational stories.

**Decision.** Server-sent events. One-way server→client is all order status
needs, `SseEmitter` is native to Spring, it works over plain HTTP, and it adds
no infrastructure. Websockets buy nothing here because order status never needs
a client→server channel.

**Current state.** The frontend renders order status from a signal in
`OrderService`. Swapping the fixture source for an SSE stream changes that
service and nothing else — no component reads the transport.

---

## OQ-04 — Frontend is Angular, not React

**Status:** Decided by the project owner, recorded for traceability.

`CLAUDE.md`'s stack block specifies "React + TypeScript + Vite". The delivered
frontend is **Angular 21** (standalone components, signals, zoneless). The block
is marked swappable in `CLAUDE.md` itself and the owner asked for Angular
directly.

**Consequence.** The stack line in `CLAUDE.md` should be amended so the binding
document and the repository agree. It has deliberately not been edited here,
because changing a binding document is the owner's call, not the implementer's.

---

## OQ-05 — TypeScript `number` is a double, so money needs its own type

**Status:** Decided, no confirmation needed.

`CLAUDE.md` says a `double` anywhere near a price, quantity or balance is a
defect. In TypeScript `number` *is* an IEEE-754 double, so the rule applies to
the frontend with full force — `0.1 + 0.2 !== 0.3` would misstate a cash balance
just as surely in a browser as on a server.

**Decision.** `Decimal` (bigint unscaled units + scale) and `Money` (Decimal +
currency) mirror `BigDecimal` on the write side. Every lossy operation demands
an explicit target scale and `RoundingMode` at the call site; there is no
default. Cross-currency arithmetic throws.

**The one sanctioned exception.** `Decimal.unsafeToNumberForChartGeometry()`
converts to a float for SVG pixel coordinates only. A chart axis is geometry,
not money, and SVG needs floats regardless. Its output is never rendered as a
figure and never re-enters a balance.

---

## OQ-06 — What is BR-01 through BR-16?

**Status:** OPEN. Blocking full traceability.

`docs/traceability.md` is required to map US IDs to BR IDs. Only five BR IDs
appear anywhere in the material available: BR-08, BR-09, BR-14 and BR-16 with
their content quoted in `CLAUDE.md`, plus BR-05 which appears only as an example
commit tag with no content given.

Every other BR row is marked `TBD`. `CLAUDE.md` forbids inventing requirements,
so they have not been guessed.

**What is needed.** The source requirements document, ideally checked into
`docs/spec.md` so every session reads the same authority.

---

## OQ-07 — Fractional share policy differs by class and is assumed, not specified

**Status:** OPEN. Assumption currently in code.

`CLAUDE.md` states that "whether fractional quantities are permitted" differs by
instrument class, and that crypto is fractional, but does not say which of the
three equity classes permit fractions.

**Current assumption.** Equities US permits fractional (4dp); Equities UK and
Equities India are whole units only; FX 2dp; Crypto 8dp. This reflects common
market practice but is not sourced from the spec.

**What is needed.** The real per-class precision table. This directly drives a
`QUANTITY_PRECISION_EXCEEDED` / `FRACTIONAL_NOT_PERMITTED` rejection that clients
will see, so a wrong assumption is client-visible.

---

## OQ-08 — Trading hours exclude public holidays

**Status:** OPEN. Known gap.

Market hours are implemented per class in each exchange's own timezone
(`Europe/London`, `America/New_York`, `Asia/Kolkata`), correctly handling DST
because they are evaluated with `Intl` rather than fixed UTC offsets. Weekends
are excluded.

**Public holidays are not.** The platform would currently accept an order on
Christmas Day. A real implementation needs an exchange holiday calendar per
class, which is reference data the spec does not mention and which has no BR
behind it.

---

## OQ-10 — Live market data deviates from Prompt 2

**Status:** Decided by the project owner. Contained, not pervasive.

Prompt 2 states: *"Do not integrate a real vendor feed; the spec does not
require one and a deterministic fixture makes the execution tests meaningful."*
A Yahoo Finance adapter now exists, which contradicts that instruction.

**How the original reasoning is preserved.** Yahoo is one implementation of a
`QuoteProvider` interface, not a replacement for fixtures. Fixtures remain the
default, back every test, and are what someone sees unless they deliberately
switch. No test touches the network. Swapping the source cannot change how an
order is priced, validated or recorded — only where the numbers originate.

**Three findings from the integration, all verified against the live service:**

1. **No CORS headers.** The browser cannot call Yahoo directly. Development goes
   through the dev-server proxy in `proxy.conf.json`. **A deployed build has no
   dev server and therefore no proxy** — the Spring backend must expose the
   equivalent endpoint before this works anywhere but a developer's laptop.
2. **The LSE quotes in pence.** `SHEL.L` returns `3344.5` with currency `GBp`.
   Read as GBP that is £3,344.50 instead of £33.45, a hundredfold overstatement
   of every UK holding, balance and P/L. The adapter declares the quoting
   currency per symbol, converts explicitly, and **refuses any currency code it
   does not recognise** rather than guessing. Covered by tests.
3. **It rate-limits hard.** Roughly fifteen requests during development earned a
   429 that persisted for over half an hour. The adapter batches the whole
   universe into one request, polls at 15s, and backs off exponentially to a
   two-minute ceiling. When it fails the UI degrades to the last good prices and
   says so; it never blanks and never invents.

**What is needed.** A decision on whether live data belongs in the assessed
deliverable at all, given Yahoo's endpoints are unofficial, undocumented, and
governed by terms that do not contemplate this use. If it stays, it needs a
licensed feed and a server-side proxy.

---

## OQ-11 — News and sentiment: the section 4.1 capability

**Status:** Proposed by the project author. No US or BR behind it.

`CLAUDE.md` forbids inventing requirements. News and headline sentiment are not
in the specification and are not claimed as delivered scope. They are the
additional capability that **section 4.1 asks the author to propose and
justify**, and the author proposed them — which is precisely what that section
requires. Recorded in `docs/traceability.md` under 4.1, not under any US.

**On the sentiment method, and its honesty.** The upstream feed carries no
sentiment field; headlines arrive with title, publisher, link and timestamp
only. Any score is therefore computed here, by matching a fixed finance word
list with simple negation handling.

That method is weak, and the implementation says so rather than hiding it:
- Every score **displays the words it matched**, so a reader can check it in a
  second and dismiss it when it is wrong.
- Results are reported as **counts** ("3 positive · 1 neutral · 1 negative"),
  never a percentage, because a percentage implies a precision this does not
  have.
- A disclaimer naming the method sits under every feed.
- The test suite deliberately **pins cases the scorer gets wrong** — sarcasm,
  and headlines about a rival filed under the wrong ticker.

**What was refused.** Presenting a fabricated or model-free "confidence" score
next to a Buy button. On a trading screen an invented signal is not decoration;
it is something a person may act on with money. For the same reason there are
**no placeholder headlines** — when the feed is unreachable the UI says so.

**On filing a headline against a stock.** A feed searched for company names
returns stories that are not about the company. Every one of these came back
from the live feed, from publishers on the finance allowlist:

- *"Iran trade falls as Khamenei urges less reliance on the U.S. dollar"* — the
  word "reliance", not Reliance Industries.
- *"Vodafone Idea's customer tide turns after long slump"* — a separately listed
  company, not Vodafone Group plc.
- *"Cubs Minor League Wrap: Smokies shell Shuckers"* — a verb.

Left alone each of those puts a sentiment score against a stock it says nothing
about. Attribution is therefore explicit and rule-based
(`core/data/news-attribution.ts`): an unambiguous name or ticker files a story on
its own; an ordinary English word — "apple", "shell", "reliance", "amazon" —
files it only when a market term appears in the same headline; a named exclusion
vetoes it. The reason is recorded per match and rendered next to the headline,
so a reader sees *"filed under SHEL on `shell + shares`"* and can reject it. It
drops a story rather than misfile it, and the tests pin both.

**What is needed.** If sentiment is to be more than illustrative it needs a real
model behind a backend, and a compliance view on presenting any sentiment signal
to retail clients at all. The same question applies to the stock board: counts
per instrument are closer to a signal than a single headline's score is, which is
why the rows are ordered by volume of coverage rather than by score.

---

## OQ-12 — "Top movers" is market data, not the PS-06 analytics

**Status:** Decided. Scope boundary worth stating explicitly.

The Markets page ranks today's biggest gainers and losers, and the Portfolio
page ranks the client's own best and worst holdings.

**Neither is US-21 or US-23.** Those are PS-06 stories: analytics by instrument
and by client segment, which BR-16 requires to run against the separate
reporting store. Computing them in the client over the trading read model would
be the exact defect `CLAUDE.md` describes — "a report query that joins to
`orders` or `positions` is a defect even if it returns the right answer".

What is built instead is narrower and legitimate: the movers strip ranks quote
data already on the page (pure PS-04), and the performance panel ranks the
client's own positions (extending US-12). Cross-client analytics remains
unstarted and belongs to the backend.

One deliberate exclusion: suspended instruments are kept out of the movers
lists. Surfacing a suspended line under "Top gainers" invites a click that
pre-trade validation will reject with `INSTRUMENT_NOT_TRADEABLE`.

---

## OQ-13 — The order review step is an addition, not a requirement

**Status:** Built. Needs a decision from whoever owns the trading rules.

No user story asks for a confirmation step. It was added because `CLAUDE.md`
opens with this:

> The firm's control today is a human standing behind every trade who catches
> mistakes before settlement. That judgement has to live in the system instead.

A market order that fires on a single click does not relocate that judgement; it
removes it. The ticket now requires a second, deliberate confirmation against a
frozen quote showing side, quantity, price, total and settlement currency, plus
the validation outcome. Escape backs out without sending.

**A design consequence worth flagging.** The quote is frozen when review opens,
and that frozen quote is what gets recorded as the order's indicative quote —
because it is what the client actually saw and agreed to. Execution still reads
the latest quote at fill time (BR-08), and the drift between the two is shown
while reviewing and again after the fill.

**What is needed.** Confirmation that a review step is wanted, and whether it
should be skippable for experienced clients. If the business wants one-click
trading, this should come out — but that decision should be explicit, given the
sentence above.

---

## OQ-14 — localStorage is a demo aid, and is not US-08

**Status:** Built. Explicitly not a story.

Orders, positions and cash now persist to `localStorage` so a demo survives a
page reload. Before this, placing an order and refreshing lost it silently.

**This is not US-08.** US-08 requires the platform to persist accepted orders,
which means a database, a transaction boundary and an audit trail.
`localStorage` is per-device, clearable by the user, trivially forgeable, and
invisible to any back office. It is a convenience for demonstrating the UI and
nothing more. `traceability.md` continues to mark US-08 as not started.

One implementation note worth keeping: `Decimal` stores its value as a `bigint`
and `JSON.stringify` throws on bigint. Amounts are persisted as integer unscaled
units plus a scale, as text, so money round-trips exactly. A lossy shortcut here
(storing amounts as JS numbers) would reintroduce the float error the entire
money layer exists to prevent. Covered by tests.

---

## OQ-09 — What the frontend does NOT prove

**Status:** Informational, so nothing downstream is mistaken for done.

The delivered frontend is a fixture-backed client. It demonstrates the domain
rules and the interaction design. It does **not** satisfy the invariants that
`CLAUDE.md` cares most about, because those are database properties:

- **US-08 / persistence** — orders live in a signal and vanish on refresh.
- **US-11 / BR-09 atomicity** — `PortfolioService.applyFill()` updates position
  and cash in one synchronous signal write, so no *render* sees a half-applied
  trade. That is not a database transaction and must not be reported as BR-09
  satisfied. The real proof is the mid-transaction failure test in Prompt 3.
- **Audit (US-17…US-20)** — nothing is appended anywhere. The order timeline in
  the UI is derived from in-memory state, not replayed from an audit log.
- **Reporting (US-21…US-25)** — no separate store exists, so BR-16 is untested.

---

## OQ-15 — Live news: the API key, the plan's limits, and what it cannot show

**Status:** Built. Extends the OQ-11 capability. Still not a US or a BR.

The section 4.1 capability now reads live headlines from NewsAPI.org, files them
against the platform's equities and rolls them up per stock. Four decisions came
out of doing it, all of which someone should be able to challenge.

**1. The key is not in the repository and not in the browser.** It is read from
`frontend/.env.local` (gitignored) or the environment by `proxy.conf.mjs`, on the
Node side of the dev-server proxy, and attached as a request header. The browser
calls `/api/news` and never sees a credential. `proxy.conf.json` became
`proxy.conf.mjs` for that reason and no other.

*What this does not solve.* A deployed build has no dev server and therefore no
proxy. The Spring backend must own this call, along with the key, the caching and
the rate limiting. Nothing here is a production secret store. This is the same
gap as OQ-10 for market data.

**2. The plan withholds recent articles, and does it silently.** A request with
no upper time bound returns HTTP 200, `"status":"ok"`, a `totalResults` in the
thousands, and an empty `articles` array. Sending an explicit `to` of the current
instant returns articles normally. Both bounds are therefore always sent. Worth
knowing before debugging a feed that looks broken with no error to explain it.

**3. Search is restricted to titles and to a publisher allowlist.** Body search
for "Apple" returned a wildlife sanctuary and two PyPI package releases on a live
run. Titles only, from a fixed list of financial publishers, and the attribution
rules on top of that. Precision over volume: a missed headline is invisible, a
wrongly filed one is scored and shown against a stock.

**4. One request per sweep, and the window is narrow.** The developer plan allows
100 requests a day. Eleven per-instrument queries per refresh would exhaust it in
an afternoon of demoing, so a sweep is a single request for the hundred most
recent headlines naming any covered company, filed locally. Responses cache for
fifteen minutes; only an explicit Refresh bypasses that.

*The consequence, stated plainly on the page.* Coverage is uneven. On a live run
the sweep returned 52 NVIDIA headlines and none at all for Shell, HSBC or
Vodafone — the plan's index simply held no title matches for the UK lines in that
window, from any publisher tried. Those rows read "No headlines in the window",
which is not the same as "nothing to report", and the board says so. A paid plan,
per-instrument queries, or a backend that sweeps on a schedule and stores the
results would each fix this; none is in scope here.

**Fallback.** Yahoo Finance search remains behind the same interface, keyless, and
answers when NewsAPI has no key, has spent its allowance, or returns nothing for a
single instrument (its title search finds nothing for an FX pair). Which source
answered is displayed. Neither source ever produces a substitute headline.

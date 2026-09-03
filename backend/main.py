"""
Local market-data service backing the frontend's live source.

Replaces direct, unofficial, unauthenticated calls to Yahoo Finance from the
browser (see OQ-10) with a small server-side wrapper around yfinance — an
open-source Python client for the same data. Running server-side rather than
from the dev-server proxy means requests come from one IP instead of every
developer's browser, and responses are shaped into exactly what the frontend
needs rather than raw Yahoo payloads.

This is a development convenience, not the production data path. A deployed
build has no dev server and no local Python process; the Spring backend must
own live pricing there. See docs/open-questions.md OQ-10.

Run: uvicorn main:app --reload --port 8000
"""

from typing import Optional

import yfinance as yf
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from yfinance.exceptions import YFRateLimitError

app = FastAPI(title="LEAP market data service")

# The Angular dev-server proxy calls this same-origin from the browser's point
# of view, so CORS is not required for normal use — this only helps someone
# hitting the service directly while developing it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Chart range code (matches the frontend's ChartRange) to yfinance's own
# period/interval vocabulary.
RANGE_TO_PERIOD_INTERVAL: dict[str, tuple[str, str]] = {
    "1D": ("1d", "5m"),
    "1W": ("5d", "30m"),
    "1M": ("1mo", "1d"),
    "3M": ("3mo", "1d"),
    "1Y": ("1y", "1wk"),
    "ALL": ("max", "1mo"),
}


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/quotes")
def quotes(symbols: str = Query(..., description="Comma-separated ticker symbols")) -> list[dict]:
    """Latest price and previous close for a batch of symbols, one call per poll."""
    tickers = [s.strip() for s in symbols.split(",") if s.strip()]
    if not tickers:
        return []

    batch = yf.Tickers(" ".join(tickers))
    results = []
    for symbol in tickers:
        try:
            info = batch.tickers[symbol].fast_info
            results.append(
                {
                    "symbol": symbol,
                    "price": float(info["last_price"]),
                    "previousClose": float(info["previous_close"]),
                    "currency": info["currency"],
                }
            )
        except YFRateLimitError as error:
            # Yahoo (via yfinance) throttles this IP hard and without warning —
            # a known finding, see docs/open-questions.md OQ-10. Surface it as
            # 429 rather than a quietly empty batch, which looks like "no data"
            # instead of "try again shortly".
            raise HTTPException(status_code=429, detail=str(error)) from error
        except Exception:
            # One bad symbol should not fail the whole batch — the caller
            # keeps its last good quote for anything missing from the result.
            continue
    return results


@app.get("/history/{symbol}")
def history(symbol: str, range: str = "1M") -> dict:
    """Price series for a chart range, plus the currency it's quoted in."""
    period, interval = RANGE_TO_PERIOD_INTERVAL.get(range, ("1mo", "1d"))
    ticker = yf.Ticker(symbol)

    try:
        frame = ticker.history(period=period, interval=interval)
    except YFRateLimitError as error:
        raise HTTPException(status_code=429, detail=str(error)) from error

    points = [
        {"timestamp": int(index.timestamp()), "close": float(row["Close"])}
        for index, row in frame.iterrows()
        if row["Close"] == row["Close"]  # drops NaN rows (holidays, gaps)
    ]

    currency: Optional[str] = None
    try:
        currency = ticker.fast_info["currency"]
    except Exception:
        pass

    return {"currency": currency, "points": points}


@app.get("/search")
def search(q: str = Query(..., min_length=2)) -> list[dict]:
    """Free-text symbol/name lookup, for a stock the local fixture universe has no record of."""
    try:
        found = yf.Search(q, max_results=8)
    except YFRateLimitError as error:
        raise HTTPException(status_code=429, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return [
        {
            "symbol": quote.get("symbol"),
            "name": quote.get("longname") or quote.get("shortname") or quote.get("symbol"),
            "exchange": quote.get("exchDisp", "Unknown"),
            "type": quote.get("quoteType", "EQUITY"),
        }
        for quote in found.quotes
        if quote.get("symbol")
    ]

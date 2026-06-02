"""Pure, dependency-free cash-flow helpers extracted from main.py so they can be
unit-tested without OpenD / the moomoo SDK.

Grounding (moomoo get_acc_cash_flow / Trd_GetCashFlow, Protocol 2226):
 - clearing_date is required and queried ONE DAY AT A TIME, so the window is a
   list of per-day date strings.
 - cashflow_direction is moomoo's authoritative IN/OUT enum (passthrough).
 - cashflow_amount is a SIGNED float (positive=inflow, negative=outflow); we keep
   the sign. No categorisation and no FX conversion happen here.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any


def cashflow_query_dates(days: int, today: date) -> list[str]:
    """The query window for get_acc_cash_flow: the last `days` calendar days
    ending `today`, weekdays (Mon–Fri) only, as 'YYYY-MM-DD' strings, most recent
    first. `i=0` is today; `i=days-1` is the oldest day in the window."""
    out: list[str] = []
    for i in range(days):
        d = today - timedelta(days=i)
        if d.weekday() < 5:  # Mon–Fri only (markets closed on weekends)
            out.append(d.strftime("%Y-%m-%d"))
    return out


def coerce_float(value: Any) -> float:
    """Mirror of main.py `_f`: tolerant float coercion, 0.0 for null/blank/bad."""
    try:
        if value in (None, "", "N\\A"):
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def parse_cashflow_row(row: dict[str, Any], clearing_date: str) -> dict[str, Any]:
    """Map one moomoo get_acc_cash_flow record to the bridge's response shape.
    Passthrough only — moomoo owns cashflow_direction (IN/OUT) and the signed
    cashflow_amount; we do not re-categorise or convert currency."""
    return {
        "cashflow_id": str(row.get("cashflow_id") or ""),
        "clearing_date": str(row.get("clearing_date") or clearing_date),
        "settlement_date": str(row.get("settlement_date") or ""),
        "currency": str(row.get("currency") or "USD"),
        "cashflow_type": str(row.get("cashflow_type") or ""),
        "cashflow_direction": str(row.get("cashflow_direction") or ""),
        "amount": coerce_float(row.get("cashflow_amount")),
        "remark": str(row.get("cashflow_remark") or ""),
    }
